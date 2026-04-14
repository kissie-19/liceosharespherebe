import pool from '../config/db.js';
let ensureTablePromise = null;
const createIndexIfMissing = async (sql) => {
    try {
        await pool.query(sql);
    }
    catch (error) {
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
        await pool.query(`CREATE TABLE IF NOT EXISTS direct_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        message_text TEXT NOT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_direct_messages_sender FOREIGN KEY (sender_id) REFERENCES register(id) ON DELETE CASCADE,
        CONSTRAINT fk_direct_messages_receiver FOREIGN KEY (receiver_id) REFERENCES register(id) ON DELETE CASCADE
      )`);
        await createIndexIfMissing('CREATE INDEX idx_direct_messages_sender_receiver_time ON direct_messages(sender_id, receiver_id, created_at)');
        await createIndexIfMissing('CREATE INDEX idx_direct_messages_receiver_read ON direct_messages(receiver_id, is_read, created_at)');
    })();
    return ensureTablePromise;
};
export const MessageModel = {
    async getConversationsForUser(userId) {
        await ensureMessagesTable();
        const [rows] = await pool.query(`SELECT
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
       ORDER BY lastMessageAt DESC, otherUserId DESC`, [userId, userId, userId, userId, userId]);
        return rows.map((row) => ({
            otherUserId: Number(row.otherUserId),
            otherName: row.otherName,
            otherProfilePicture: row.otherProfilePicture,
            lastMessage: row.lastMessage,
            lastMessageAt: row.lastMessageAt,
            unreadCount: Number(row.unreadCount || 0)
        }));
    },
    async getThread(userId, otherUserId) {
        await ensureMessagesTable();
        const [rows] = await pool.query(`SELECT dm.id,
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
       ORDER BY dm.created_at ASC, dm.id ASC`, [userId, otherUserId, otherUserId, userId]);
        return rows.map((row) => ({
            id: Number(row.id),
            senderId: Number(row.senderId),
            receiverId: Number(row.receiverId),
            messageText: row.messageText,
            isRead: Number(row.isRead) === 1,
            createdAt: row.createdAt,
            senderName: row.senderName,
            senderProfilePicture: row.senderProfilePicture
        }));
    },
    async sendMessage(senderId, receiverId, messageText) {
        await ensureMessagesTable();
        const trimmedMessage = messageText.trim();
        if (!trimmedMessage) {
            throw new Error('Message text is required.');
        }
        if (senderId === receiverId) {
            throw new Error('Cannot send a message to yourself.');
        }
        const [insertResult] = await pool.query(`INSERT INTO direct_messages (sender_id, receiver_id, message_text)
       VALUES (?, ?, ?)`, [senderId, receiverId, trimmedMessage]);
        const [rows] = await pool.query(`SELECT dm.id,
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
       LIMIT 1`, [insertResult.insertId]);
        const row = rows[0];
        return {
            id: Number(row.id),
            senderId: Number(row.senderId),
            receiverId: Number(row.receiverId),
            messageText: row.messageText,
            isRead: Number(row.isRead) === 1,
            createdAt: row.createdAt,
            senderName: row.senderName,
            senderProfilePicture: row.senderProfilePicture
        };
    },
    async markThreadAsRead(userId, otherUserId) {
        await ensureMessagesTable();
        const [result] = await pool.query(`UPDATE direct_messages
       SET is_read = 1
       WHERE sender_id = ?
         AND receiver_id = ?
         AND is_read = 0`, [otherUserId, userId]);
        return Number(result.affectedRows || 0);
    },
    async getUnreadCountForUser(userId) {
        await ensureMessagesTable();
        const [rows] = await pool.query(`SELECT COUNT(*) AS unreadCount
       FROM direct_messages
       WHERE receiver_id = ?
         AND is_read = 0`, [userId]);
        return Number(rows[0]?.unreadCount || 0);
    }
};
