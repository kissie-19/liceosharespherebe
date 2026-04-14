import pool from '../config/db.js';
const statusesThatClosePendingRequests = new Set(['borrowed', 'returned']);
export const PostModel = {
    async create(userId, itemName, description, attachment, status = 'available') {
        const [result] = await pool.query('INSERT INTO posts (user_id, item_name, description, attachment, status) VALUES (?, ?, ?, ?, ?)', [userId, itemName, description, attachment || null, status]);
        return this.findById(result.insertId);
    },
    async findById(postId) {
        const [rows] = await pool.query(`SELECT p.id,
              p.user_id,
              p.user_id AS userId,
              p.item_name,
              p.item_name AS itemName,
              p.description,
              p.attachment,
              p.status,
              p.created_at,
              p.created_at AS createdAt,
              r.id AS ownerId,
              COALESCE(r.fullname, 'Unknown') AS owner,
              COALESCE(r.fullname, 'Unknown') AS fullname,
              r.profile_picture,
              r.profile_picture AS ownerProfilePicture,
              r.department,
              r.email
       FROM posts p
            LEFT JOIN register r ON p.user_id = r.id
       WHERE p.id = ?`, [postId]);
        return rows[0] ?? null;
    },
    async findByIdWithConnection(postId, connection) {
        const [rows] = await connection.query(`SELECT p.id,
              p.user_id,
              p.user_id AS userId,
              p.item_name,
              p.item_name AS itemName,
              p.description,
              p.attachment,
              p.status,
              p.created_at,
              p.created_at AS createdAt,
              r.id AS ownerId,
              COALESCE(r.fullname, 'Unknown') AS owner,
              COALESCE(r.fullname, 'Unknown') AS fullname,
              r.profile_picture,
              r.profile_picture AS ownerProfilePicture,
              r.department,
              r.email
       FROM posts p
            LEFT JOIN register r ON p.user_id = r.id
       WHERE p.id = ?`, [postId]);
        return rows[0] ?? null;
    },
    async findAll() {
        const [rows] = await pool.query(`SELECT p.id,
              p.user_id,
              p.user_id AS userId,
              p.item_name,
              p.item_name AS itemName,
              p.description,
              p.attachment,
              p.status,
              p.created_at,
              p.created_at AS createdAt,
              r.id AS ownerId,
              COALESCE(r.fullname, 'Unknown') AS owner,
              COALESCE(r.fullname, 'Unknown') AS fullname,
              r.profile_picture,
              r.profile_picture AS ownerProfilePicture,
              r.department,
              r.email
              FROM posts p
                INNER JOIN register r ON p.user_id = r.id
       ORDER BY p.created_at DESC, p.id DESC`);
        return rows;
    },
    async updateOwnedPost(postId, userId, itemName, description, status, attachment) {
        const nextStatus = status || 'available';
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.query('UPDATE posts SET item_name = ?, description = ?, attachment = ?, status = ? WHERE id = ? AND user_id = ?', [itemName, description, attachment || null, nextStatus, postId, userId]);
            if (result.affectedRows === 0) {
                await connection.rollback();
                return null;
            }
            if (statusesThatClosePendingRequests.has(nextStatus)) {
                const [pendingRequests] = await connection.query(`SELECT id, borrower_id AS borrowerId
           FROM borrow_requests
           WHERE post_id = ?
             AND status = 'pending'`, [postId]);
                if (pendingRequests.length > 0) {
                    await connection.query(`UPDATE borrow_requests
             SET status = 'declined'
             WHERE post_id = ?
               AND status = 'pending'`, [postId]);
                    for (const pendingRequest of pendingRequests) {
                        await connection.query(`INSERT INTO borrow_notifications (request_id, recipient_id, actor_id, type)
               VALUES (?, ?, ?, 'request-declined')`, [pendingRequest.id, pendingRequest.borrowerId, userId]);
                    }
                }
            }
            const post = await this.findByIdWithConnection(postId, connection);
            await connection.commit();
            return post;
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    },
    async deleteOwnedPost(postId, userId) {
        const [result] = await pool.query('DELETE FROM posts WHERE id = ? AND user_id = ?', [postId, userId]);
        return result.affectedRows > 0;
    }
};
