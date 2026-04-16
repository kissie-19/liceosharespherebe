import pool from '../config/db.js';
let ensureSystemNotificationsTablePromise = null;
const createIndexIfMissing = async (sql) => {
    try {
        await pool.query(sql);
    }
    catch (error) {
        const errorCode = String(error?.code ?? '');
        if (errorCode !== 'ER_DUP_KEYNAME') {
            throw error;
        }
    }
};
const ensureSystemNotificationsTable = async () => {
    if (ensureSystemNotificationsTablePromise) {
        return ensureSystemNotificationsTablePromise;
    }
    ensureSystemNotificationsTablePromise = (async () => {
        await pool.query(`CREATE TABLE IF NOT EXISTS system_notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        post_id INT NULL,
        recipient_id INT NOT NULL,
        actor_id INT NOT NULL,
        type ENUM('post-deleted') NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_system_notifications_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL,
        CONSTRAINT fk_system_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES register(id) ON DELETE CASCADE,
        CONSTRAINT fk_system_notifications_actor FOREIGN KEY (actor_id) REFERENCES register(id) ON DELETE CASCADE
      )`);
        await createIndexIfMissing('CREATE INDEX idx_system_notifications_recipient_created ON system_notifications(recipient_id, created_at)');
    })();
    return ensureSystemNotificationsTablePromise;
};
const toIsoString = (value) => {
    if (value instanceof Date) {
        return value.toISOString();
    }
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? String(value) : parsedDate.toISOString();
};
export const SystemNotificationModel = {
    ensureTable: ensureSystemNotificationsTable,
    async getNotificationsForUser(recipientId) {
        await ensureSystemNotificationsTable();
        const [rows] = await pool.query(`SELECT
         sn.id,
         sn.post_id AS postId,
         sn.recipient_id AS recipientId,
         sn.actor_id AS actorId,
         sn.type,
         sn.message,
         sn.created_at AS createdAt
       FROM system_notifications sn
       WHERE sn.recipient_id = ?
       ORDER BY sn.created_at DESC, sn.id DESC`, [recipientId]);
        return rows.map((row) => ({
            id: row.id,
            postId: row.postId,
            recipientId: row.recipientId,
            actorId: row.actorId,
            type: row.type,
            message: row.message,
            createdAt: toIsoString(row.createdAt)
        }));
    },
    async deleteNotificationForUser(notificationId, recipientId) {
        await ensureSystemNotificationsTable();
        const [result] = await pool.query('DELETE FROM system_notifications WHERE id = ? AND recipient_id = ?', [notificationId, recipientId]);
        return result.affectedRows > 0;
    }
};
