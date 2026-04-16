import crypto from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/db.js';

type ConversationRow = RowDataPacket & {
  otherUserId: number;
  otherName: string;
  otherProfilePicture: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

type MessageRow = RowDataPacket & {
  id: number;
  senderId: number;
  receiverId: number;
  messageText: string;
  isRead: 0 | 1;
  createdAt: string;
  senderName: string;
  senderProfilePicture: string;
};

type UnreadCountRow = RowDataPacket & {
  unreadCount: number;
};

export interface ConversationItem {
  otherUserId: number;
  otherName: string;
  otherProfilePicture: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface ChatMessageItem {
  id: number;
  senderId: number;
  receiverId: number;
  messageText: string;
  isRead: boolean;
  createdAt: string;
  senderName: string;
  senderProfilePicture: string;
}

let ensureTablePromise: Promise<void> | null = null;

const createIndexIfMissing = async (sql: string) => {
  try {
    await pool.query(sql);
  } catch (error: any) {
    // MySQL doesn't support CREATE INDEX IF NOT EXISTS on all versions.
    // Ignore duplicate index errors so startup remains idempotent.
    const errorCode = String(error?.code ?? '');
    if (errorCode !== 'ER_DUP_KEYNAME') {
      throw error;
    }
  }
};

const ensureMessagesTable = async () => {
  if (ensureTablePromise) {
    return ensureTablePromise;
  }

  ensureTablePromise = (async () => {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS direct_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        message_text TEXT NOT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_direct_messages_sender FOREIGN KEY (sender_id) REFERENCES register(id) ON DELETE CASCADE,
        CONSTRAINT fk_direct_messages_receiver FOREIGN KEY (receiver_id) REFERENCES register(id) ON DELETE CASCADE
      )`
    );

    await createIndexIfMissing('CREATE INDEX idx_direct_messages_sender_receiver_time ON direct_messages(sender_id, receiver_id, created_at)');
    await createIndexIfMissing('CREATE INDEX idx_direct_messages_receiver_read ON direct_messages(receiver_id, is_read, created_at)');
  })();

  return ensureTablePromise;
};

const getEncryptionKey = (): Buffer => {
  const key = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!key || !key.trim()) {
    throw new Error('MESSAGE_ENCRYPTION_KEY environment variable is required for message encryption.');
  }

  return crypto.createHash('sha256').update(key, 'utf8').digest();
};

const encryptText = (text: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

const decryptText = (cipherText: string): string => {
  if (!cipherText || typeof cipherText !== 'string') {
    return cipherText;
  }

  const parts = cipherText.split(':');
  if (parts.length < 3) {
    return cipherText;
  }

  const iv = Buffer.from(parts[0], 'base64');
  const tag = Buffer.from(parts[1], 'base64');
  const encrypted = Buffer.from(parts.slice(2).join(':'), 'base64');

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return cipherText;
  }
};

export const MessageModel = {
  async getConversationsForUser(userId: number): Promise<ConversationItem[]> {
    await ensureMessagesTable();

    const [rows] = await pool.query<ConversationRow[]>(
      `SELECT
          CASE WHEN dm.sender_id = ? THEN dm.receiver_id ELSE dm.sender_id END AS otherUserId,
          other.fullname AS otherName,
          COALESCE(other.profile_picture, '') AS otherProfilePicture,
          SUBSTRING_INDEX(GROUP_CONCAT(dm.message_text ORDER BY dm.created_at DESC, dm.id DESC SEPARATOR '\\n'), '\\n', 1) AS lastMessage,
          MAX(dm.created_at) AS lastMessageAt,
          SUM(CASE WHEN dm.receiver_id = ? AND dm.is_read = 0 THEN 1 ELSE 0 END) AS unreadCount
       FROM direct_messages dm
       JOIN register other
         ON other.id = CASE WHEN dm.sender_id = ? THEN dm.receiver_id ELSE dm.sender_id END
       WHERE dm.sender_id = ? OR dm.receiver_id = ?
       GROUP BY otherUserId, otherName, otherProfilePicture
       ORDER BY lastMessageAt DESC, otherUserId DESC`,
      [userId, userId, userId, userId, userId]
    );

    return rows.map((row) => ({
      otherUserId: Number(row.otherUserId),
      otherName: row.otherName,
      otherProfilePicture: row.otherProfilePicture,
      lastMessage: decryptText(row.lastMessage),
      lastMessageAt: row.lastMessageAt,
      unreadCount: Number(row.unreadCount || 0)
    }));
  },

  async getThread(userId: number, otherUserId: number): Promise<ChatMessageItem[]> {
    await ensureMessagesTable();

    const [rows] = await pool.query<MessageRow[]>(
      `SELECT dm.id,
              dm.sender_id AS senderId,
              dm.receiver_id AS receiverId,
              dm.message_text AS messageText,
              dm.is_read AS isRead,
              dm.created_at AS createdAt,
              sender.fullname AS senderName,
              COALESCE(sender.profile_picture, '') AS senderProfilePicture
       FROM direct_messages dm
       JOIN register sender ON sender.id = dm.sender_id
       WHERE (dm.sender_id = ? AND dm.receiver_id = ?)
          OR (dm.sender_id = ? AND dm.receiver_id = ?)
       ORDER BY dm.created_at ASC, dm.id ASC`,
      [userId, otherUserId, otherUserId, userId]
    );

    return rows.map((row) => ({
      id: Number(row.id),
      senderId: Number(row.senderId),
      receiverId: Number(row.receiverId),
      messageText: decryptText(row.messageText),
      isRead: Number(row.isRead) === 1,
      createdAt: row.createdAt,
      senderName: row.senderName,
      senderProfilePicture: row.senderProfilePicture
    }));
  },

  async sendMessage(senderId: number, receiverId: number, messageText: string): Promise<ChatMessageItem> {
    await ensureMessagesTable();

    const trimmedMessage = messageText.trim();
    if (!trimmedMessage) {
      throw new Error('Message text is required.');
    }

    if (senderId === receiverId) {
      throw new Error('Cannot send a message to yourself.');
    }

    const encryptedMessage = encryptText(trimmedMessage);

    const [insertResult] = await pool.query<ResultSetHeader>(
      `INSERT INTO direct_messages (sender_id, receiver_id, message_text)
       VALUES (?, ?, ?)`,
      [senderId, receiverId, encryptedMessage]
    );

    const [rows] = await pool.query<MessageRow[]>(
      `SELECT dm.id,
              dm.sender_id AS senderId,
              dm.receiver_id AS receiverId,
              dm.message_text AS messageText,
              dm.is_read AS isRead,
              dm.created_at AS createdAt,
              sender.fullname AS senderName,
              COALESCE(sender.profile_picture, '') AS senderProfilePicture
       FROM direct_messages dm
       JOIN register sender ON sender.id = dm.sender_id
       WHERE dm.id = ?
       LIMIT 1`,
      [insertResult.insertId]
    );

    const row = rows[0];
    return {
      id: Number(row.id),
      senderId: Number(row.senderId),
      receiverId: Number(row.receiverId),
      messageText: decryptText(row.messageText),
      isRead: Number(row.isRead) === 1,
      createdAt: row.createdAt,
      senderName: row.senderName,
      senderProfilePicture: row.senderProfilePicture
    };
  },

  async markThreadAsRead(userId: number, otherUserId: number): Promise<number> {
    await ensureMessagesTable();

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE direct_messages
       SET is_read = 1
       WHERE sender_id = ?
         AND receiver_id = ?
         AND is_read = 0`,
      [otherUserId, userId]
    );

    return Number(result.affectedRows || 0);
  },

  async getUnreadCountForUser(userId: number): Promise<number> {
    await ensureMessagesTable();

    const [rows] = await pool.query<UnreadCountRow[]>(
      `SELECT COUNT(*) AS unreadCount
       FROM direct_messages
       WHERE receiver_id = ?
         AND is_read = 0`,
      [userId]
    );

    return Number(rows[0]?.unreadCount || 0);
  }
};

export const MessageCrypto = {
  encryptText,
  decryptText
};
