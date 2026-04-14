import pool from '../config/db.js';
class BorrowRequestError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'BorrowRequestError';
    }
}
const borrowRequestSelect = `SELECT br.id,
                                    br.post_id AS postId,
                                    p.item_name AS postName,
                                    COALESCE(p.attachment, '') AS postImage,
                                    br.owner_id AS ownerId,
                                    owner.fullname AS ownerName,
                                    COALESCE(owner.profile_picture, '') AS ownerProfilePicture,
                                    br.borrower_id AS borrowerId,
                                    borrower.fullname AS borrowerName,
                                    COALESCE(borrower.profile_picture, '') AS borrowerProfilePicture,
                                    br.requested_at AS requestedAt,
                                    br.updated_at AS updatedAt,
                                    br.status
                             FROM borrow_requests br
                             JOIN posts p ON p.id = br.post_id
                             JOIN register owner ON owner.id = br.owner_id
                             JOIN register borrower ON borrower.id = br.borrower_id`;
const notificationSelect = `SELECT bn.id,
                                   bn.request_id AS requestId,
                                   br.post_id AS postId,
                                   bn.type,
                                   actor.fullname AS actorName,
                                   COALESCE(actor.profile_picture, '') AS actorProfilePicture,
                                   p.item_name AS itemName,
                                   br.status,
                                   bn.created_at AS createdAt
                            FROM borrow_notifications bn
                            JOIN borrow_requests br ON br.id = bn.request_id
                            JOIN posts p ON p.id = br.post_id
                            JOIN register actor ON actor.id = bn.actor_id`;
const toIsoString = (value) => {
    if (value instanceof Date) {
        return value.toISOString();
    }
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? String(value) : parsedDate.toISOString();
};
const mapRequestRow = (row) => ({
    id: row.id,
    postId: row.postId,
    postName: row.postName,
    postImage: row.postImage ?? '',
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    ownerProfilePicture: row.ownerProfilePicture ?? '',
    borrowerId: row.borrowerId,
    borrowerName: row.borrowerName,
    borrowerProfilePicture: row.borrowerProfilePicture ?? '',
    requestedAt: toIsoString(row.requestedAt),
    updatedAt: toIsoString(row.updatedAt),
    status: row.status
});
const mapNotificationRow = (row) => ({
    id: row.id,
    requestId: row.requestId,
    postId: row.postId,
    type: row.type,
    actorName: row.actorName,
    actorProfilePicture: row.actorProfilePicture ?? '',
    itemName: row.itemName,
    status: row.status,
    createdAt: toIsoString(row.createdAt)
});
const mapBorrowedItemRow = (row) => ({
    requestId: row.requestId,
    postId: row.postId,
    name: row.name,
    image: row.image ?? '',
    owner: row.owner,
    ownerProfilePicture: row.ownerProfilePicture ?? '',
    requestedAt: toIsoString(row.requestedAt),
    approvedAt: toIsoString(row.approvedAt),
    status: 'borrowed'
});
const mapLentItemRow = (row) => ({
    requestId: row.requestId,
    postId: row.postId,
    name: row.name,
    image: row.image ?? '',
    borrower: row.borrower,
    borrowerProfilePicture: row.borrowerProfilePicture ?? '',
    requestedAt: toIsoString(row.requestedAt),
    approvedAt: toIsoString(row.approvedAt),
    status: 'lent'
});
const getRequestById = async (requestId, connection) => {
    const executor = connection ?? pool;
    const [rows] = await executor.query(`${borrowRequestSelect} WHERE br.id = ?`, [requestId]);
    return rows[0] ? mapRequestRow(rows[0]) : null;
};
const getPostForBorrowRequest = async (postId, connection) => {
    const executor = connection ?? pool;
    const [rows] = await executor.query(`SELECT id,
            user_id AS ownerId,
            status
     FROM posts
     WHERE id = ?`, [postId]);
    return rows[0] ?? null;
};
export const BorrowRequestModel = {
    isBorrowRequestError(error) {
        return error instanceof BorrowRequestError;
    },
    async getRequestsForBorrower(borrowerId) {
        const [rows] = await pool.query(`${borrowRequestSelect}
       WHERE br.borrower_id = ?
       ORDER BY br.updated_at DESC, br.id DESC`, [borrowerId]);
        return rows.map(mapRequestRow);
    },
    async getPendingRequestsForOwner(ownerId) {
        const [rows] = await pool.query(`${borrowRequestSelect}
       WHERE br.owner_id = ?
         AND br.status = 'pending'
         AND p.status <> 'borrowed'
       ORDER BY br.updated_at DESC, br.id DESC`, [ownerId]);
        return rows.map(mapRequestRow);
    },
    async createRequest(postId, ownerId, borrowerId) {
        if (ownerId === borrowerId) {
            throw new BorrowRequestError(400, 'You cannot borrow your own item.');
        }
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const post = await getPostForBorrowRequest(postId, connection);
            if (!post) {
                throw new BorrowRequestError(404, 'Post not found.');
            }
            if (post.ownerId !== ownerId) {
                throw new BorrowRequestError(400, 'Owner does not match the selected post.');
            }
            if (post.status === 'borrowed') {
                throw new BorrowRequestError(400, 'This item is not available right now.');
            }
            const [existingRequests] = await connection.query(`SELECT id,
                borrower_id AS borrowerId
         FROM borrow_requests
         WHERE post_id = ?
           AND borrower_id = ?
           AND status = 'pending'
         FOR UPDATE`, [postId, borrowerId]);
            if (existingRequests.length > 0) {
                throw new BorrowRequestError(409, 'Your borrow request is already pending.');
            }
            const [result] = await connection.query(`INSERT INTO borrow_requests (post_id, owner_id, borrower_id, status)
         VALUES (?, ?, ?, 'pending')`, [postId, ownerId, borrowerId]);
            await connection.query(`INSERT INTO borrow_notifications (request_id, recipient_id, actor_id, type)
         VALUES (?, ?, ?, 'incoming-request')`, [result.insertId, ownerId, borrowerId]);
            const request = await getRequestById(result.insertId, connection);
            await connection.commit();
            return {
                request,
                post: {
                    id: postId,
                    status: 'available'
                }
            };
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    },
    async approveRequest(requestId, ownerId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [requestRows] = await connection.query(`SELECT id,
                post_id AS postId,
                owner_id AS ownerId,
                borrower_id AS borrowerId,
                status
         FROM borrow_requests
         WHERE id = ?
         FOR UPDATE`, [requestId]);
            if (requestRows.length === 0) {
                throw new BorrowRequestError(404, 'Borrow request not found.');
            }
            const requestRow = requestRows[0];
            if (requestRow.ownerId !== ownerId) {
                throw new BorrowRequestError(403, 'Only the owner can approve this request.');
            }
            if (requestRow.status !== 'pending') {
                throw new BorrowRequestError(400, 'This request is no longer available.');
            }
            const [otherActiveRows] = await connection.query(`SELECT id,
                borrower_id AS borrowerId,
                status
         FROM borrow_requests
         WHERE post_id = ?
           AND id <> ?
           AND status IN ('pending', 'approved')
         FOR UPDATE`, [requestRow.postId, requestId]);
            await connection.query(`UPDATE borrow_requests
         SET status = 'approved', approved_at = NOW()
         WHERE id = ?`, [requestId]);
            if (otherActiveRows.length > 0) {
                await connection.query(`UPDATE borrow_requests
           SET status = 'declined'
           WHERE post_id = ?
             AND id <> ?
             AND status IN ('pending', 'approved')`, [requestRow.postId, requestId]);
            }
            await connection.query(`UPDATE posts
         SET status = 'borrowed'
         WHERE id = ?`, [requestRow.postId]);
            await connection.query(`INSERT INTO borrow_notifications (request_id, recipient_id, actor_id, type)
         VALUES (?, ?, ?, 'request-approved')`, [requestId, requestRow.borrowerId, ownerId]);
            const request = await getRequestById(requestId, connection);
            await connection.commit();
            return {
                request,
                post: {
                    id: requestRow.postId,
                    status: 'borrowed'
                }
            };
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    },
    async declineRequest(requestId, ownerId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [requestRows] = await connection.query(`SELECT id,
                post_id AS postId,
                owner_id AS ownerId,
                borrower_id AS borrowerId,
                status
         FROM borrow_requests
         WHERE id = ?
         FOR UPDATE`, [requestId]);
            if (requestRows.length === 0) {
                throw new BorrowRequestError(404, 'Borrow request not found.');
            }
            const requestRow = requestRows[0];
            if (requestRow.ownerId !== ownerId) {
                throw new BorrowRequestError(403, 'Only the owner can decline this request.');
            }
            if (requestRow.status !== 'pending') {
                throw new BorrowRequestError(400, 'This request is no longer available.');
            }
            await connection.query(`UPDATE borrow_requests
         SET status = 'declined'
         WHERE id = ?`, [requestId]);
            await connection.query(`UPDATE posts
         SET status = ?
         WHERE id = ?`, ['available', requestRow.postId]);
            await connection.query(`INSERT INTO borrow_notifications (request_id, recipient_id, actor_id, type)
         VALUES (?, ?, ?, 'request-declined')`, [requestId, requestRow.borrowerId, ownerId]);
            const request = await getRequestById(requestId, connection);
            await connection.commit();
            return {
                request,
                post: {
                    id: requestRow.postId,
                    status: 'available'
                }
            };
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    },
    async getNotificationsForUser(userId) {
        await pool.query(`INSERT INTO borrow_notifications (request_id, recipient_id, actor_id, type)
       SELECT br.id,
              br.borrower_id,
              br.owner_id,
              'request-approved' AS type
       FROM borrow_requests br
       LEFT JOIN borrow_notifications bn
         ON bn.request_id = br.id
        AND bn.recipient_id = br.borrower_id
        AND bn.type = 'request-approved'
       WHERE br.borrower_id = ?
         AND br.status = 'approved'
         AND bn.id IS NULL`, [userId]);
        const [rows] = await pool.query(`${notificationSelect}
       WHERE bn.recipient_id = ?
         AND (
           bn.type <> 'incoming-request'
           OR (
             br.status = 'pending'
             AND p.status <> 'borrowed'
           )
         )
       ORDER BY bn.created_at DESC, bn.id DESC`, [userId]);
        return rows.map(mapNotificationRow);
    },
    async getBorrowedItemsForUser(userId) {
        const [rows] = await pool.query(`SELECT br.id AS requestId,
              p.id AS postId,
              p.item_name AS name,
              COALESCE(p.attachment, '') AS image,
              owner.fullname AS owner,
              COALESCE(owner.profile_picture, '') AS ownerProfilePicture,
              br.requested_at AS requestedAt,
              br.approved_at AS approvedAt
       FROM borrow_requests br
       JOIN posts p ON p.id = br.post_id
       JOIN register owner ON owner.id = br.owner_id
       WHERE br.borrower_id = ?
         AND br.approved_at IS NOT NULL
       ORDER BY br.approved_at DESC, br.id DESC`, [userId]);
        return rows.map(mapBorrowedItemRow);
    },
    async getLentItemsForUser(userId) {
        const [rows] = await pool.query(`SELECT br.id AS requestId,
              p.id AS postId,
              p.item_name AS name,
              COALESCE(p.attachment, '') AS image,
              borrower.fullname AS borrower,
              COALESCE(borrower.profile_picture, '') AS borrowerProfilePicture,
              br.requested_at AS requestedAt,
              br.approved_at AS approvedAt
       FROM borrow_requests br
       JOIN posts p ON p.id = br.post_id
       JOIN register borrower ON borrower.id = br.borrower_id
       WHERE br.owner_id = ?
         AND br.approved_at IS NOT NULL
       ORDER BY br.approved_at DESC, br.id DESC`, [userId]);
        return rows.map(mapLentItemRow);
    }
};
