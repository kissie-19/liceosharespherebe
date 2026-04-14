import pool from '../config/db.js';
import type { PoolConnection } from 'mysql2/promise';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export type BorrowRequestStatus = 'pending' | 'approved' | 'declined';
export type BorrowNotificationType = 'incoming-request' | 'request-approved' | 'request-declined';

export interface BorrowRequestRecord {
  id: number;
  postId: number;
  postName: string;
  postImage: string;
  ownerId: number;
  ownerName: string;
  ownerProfilePicture: string;
  borrowerId: number;
  borrowerName: string;
  borrowerProfilePicture: string;
  requestedAt: string;
  updatedAt: string;
  status: BorrowRequestStatus;
}

export interface BorrowNotificationRecord {
  id: number;
  requestId: number;
  postId: number;
  type: BorrowNotificationType;
  actorName: string;
  actorProfilePicture: string;
  itemName: string;
  status: BorrowRequestStatus;
  createdAt: string;
}

export interface BorrowedItemRecord {
  requestId: number;
  postId: number;
  name: string;
  image: string;
  owner: string;
  ownerProfilePicture: string;
  requestedAt: string;
  approvedAt: string;
  status: 'borrowed';
}

export interface LentItemRecord {
  requestId: number;
  postId: number;
  name: string;
  image: string;
  borrower: string;
  borrowerProfilePicture: string;
  requestedAt: string;
  approvedAt: string;
  status: 'lent';
}

class BorrowRequestError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'BorrowRequestError';
  }
}

interface BorrowRequestRow extends RowDataPacket {
  id: number;
  postId: number;
  postName: string;
  postImage: string | null;
  ownerId: number;
  ownerName: string;
  ownerProfilePicture: string | null;
  borrowerId: number;
  borrowerName: string;
  borrowerProfilePicture: string | null;
  requestedAt: Date | string;
  updatedAt: Date | string;
  status: BorrowRequestStatus;
}

interface BorrowNotificationRow extends RowDataPacket {
  id: number;
  requestId: number;
  postId: number;
  type: BorrowNotificationType;
  actorName: string;
  actorProfilePicture: string | null;
  itemName: string;
  status: BorrowRequestStatus;
  createdAt: Date | string;
}

interface BorrowedItemRow extends RowDataPacket {
  requestId: number;
  postId: number;
  name: string;
  image: string | null;
  owner: string;
  ownerProfilePicture: string | null;
  requestedAt: Date | string;
  approvedAt: Date | string;
}

interface LentItemRow extends RowDataPacket {
  requestId: number;
  postId: number;
  name: string;
  image: string | null;
  borrower: string;
  borrowerProfilePicture: string | null;
  requestedAt: Date | string;
  approvedAt: Date | string;
}

interface PostOwnershipRow extends RowDataPacket {
  id: number;
  ownerId: number;
  status: string;
}

interface PendingRequestRow extends RowDataPacket {
  id: number;
  borrowerId: number;
}

interface ActiveCompetingRequestRow extends RowDataPacket {
  id: number;
  borrowerId: number;
  status: BorrowRequestStatus;
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

const toIsoString = (value: Date | string) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? String(value) : parsedDate.toISOString();
};

const mapRequestRow = (row: BorrowRequestRow): BorrowRequestRecord => ({
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

const mapNotificationRow = (row: BorrowNotificationRow): BorrowNotificationRecord => ({
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

const mapBorrowedItemRow = (row: BorrowedItemRow): BorrowedItemRecord => ({
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

const mapLentItemRow = (row: LentItemRow): LentItemRecord => ({
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

const getRequestById = async (requestId: number, connection?: PoolConnection) => {
  const executor = connection ?? pool;
  const [rows] = await executor.query<BorrowRequestRow[]>(
    `${borrowRequestSelect} WHERE br.id = ?`,
    [requestId]
  );

  return rows[0] ? mapRequestRow(rows[0]) : null;
};

const getPostForBorrowRequest = async (postId: number, connection?: PoolConnection) => {
  const executor = connection ?? pool;
  const [rows] = await executor.query<PostOwnershipRow[]>(
    `SELECT id,
            user_id AS ownerId,
            status
     FROM posts
     WHERE id = ?`,
    [postId]
  );

  return rows[0] ?? null;
};

export const BorrowRequestModel = {
  isBorrowRequestError(error: unknown): error is BorrowRequestError {
    return error instanceof BorrowRequestError;
  },

  async getRequestsForBorrower(borrowerId: number) {
    const [rows] = await pool.query<BorrowRequestRow[]>(
      `${borrowRequestSelect}
       WHERE br.borrower_id = ?
       ORDER BY br.updated_at DESC, br.id DESC`,
      [borrowerId]
    );

    return rows.map(mapRequestRow);
  },

  async getPendingRequestsForOwner(ownerId: number) {
    const [rows] = await pool.query<BorrowRequestRow[]>(
      `${borrowRequestSelect}
       WHERE br.owner_id = ?
         AND br.status = 'pending'
         AND p.status <> 'borrowed'
       ORDER BY br.updated_at DESC, br.id DESC`,
      [ownerId]
    );

    return rows.map(mapRequestRow);
  },

  async createRequest(postId: number, ownerId: number, borrowerId: number) {
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

      const [existingRequests] = await connection.query<RowDataPacket[]>(
        `SELECT id,
                borrower_id AS borrowerId
         FROM borrow_requests
         WHERE post_id = ?
           AND borrower_id = ?
           AND status = 'pending'
         FOR UPDATE`,
        [postId, borrowerId]
      );

      if (existingRequests.length > 0) {
        throw new BorrowRequestError(409, 'Your borrow request is already pending.');
      }

      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO borrow_requests (post_id, owner_id, borrower_id, status)
         VALUES (?, ?, ?, 'pending')`,
        [postId, ownerId, borrowerId]
      );

      await connection.query<ResultSetHeader>(
        `INSERT INTO borrow_notifications (request_id, recipient_id, actor_id, type)
         VALUES (?, ?, ?, 'incoming-request')`,
        [result.insertId, ownerId, borrowerId]
      );

      const request = await getRequestById(result.insertId, connection);

      await connection.commit();
      return {
        request,
        post: {
          id: postId,
          status: 'available'
        }
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async approveRequest(requestId: number, ownerId: number) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [requestRows] = await connection.query<RowDataPacket[]>(
        `SELECT id,
                post_id AS postId,
                owner_id AS ownerId,
                borrower_id AS borrowerId,
                status
         FROM borrow_requests
         WHERE id = ?
         FOR UPDATE`,
        [requestId]
      );

      if (requestRows.length === 0) {
        throw new BorrowRequestError(404, 'Borrow request not found.');
      }

      const requestRow = requestRows[0] as RowDataPacket & {
        id: number;
        postId: number;
        ownerId: number;
        borrowerId: number;
        status: BorrowRequestStatus;
      };

      if (requestRow.ownerId !== ownerId) {
        throw new BorrowRequestError(403, 'Only the owner can approve this request.');
      }

      if (requestRow.status !== 'pending') {
        throw new BorrowRequestError(400, 'This request is no longer available.');
      }

      const [otherActiveRows] = await connection.query<ActiveCompetingRequestRow[]>(
        `SELECT id,
                borrower_id AS borrowerId,
                status
         FROM borrow_requests
         WHERE post_id = ?
           AND id <> ?
           AND status IN ('pending', 'approved')
         FOR UPDATE`,
        [requestRow.postId, requestId]
      );

      await connection.query<ResultSetHeader>(
        `UPDATE borrow_requests
         SET status = 'approved', approved_at = NOW()
         WHERE id = ?`,
        [requestId]
      );

      if (otherActiveRows.length > 0) {
        await connection.query<ResultSetHeader>(
          `UPDATE borrow_requests
           SET status = 'declined'
           WHERE post_id = ?
             AND id <> ?
             AND status IN ('pending', 'approved')`,
          [requestRow.postId, requestId]
        );
      }

      await connection.query<ResultSetHeader>(
        `UPDATE posts
         SET status = 'borrowed'
         WHERE id = ?`,
        [requestRow.postId]
      );

      await connection.query<ResultSetHeader>(
        `INSERT INTO borrow_notifications (request_id, recipient_id, actor_id, type)
         VALUES (?, ?, ?, 'request-approved')`,
        [requestId, requestRow.borrowerId, ownerId]
      );

      const request = await getRequestById(requestId, connection);

      await connection.commit();

      return {
        request,
        post: {
          id: requestRow.postId,
          status: 'borrowed'
        }
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async declineRequest(requestId: number, ownerId: number) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [requestRows] = await connection.query<RowDataPacket[]>(
        `SELECT id,
                post_id AS postId,
                owner_id AS ownerId,
                borrower_id AS borrowerId,
                status
         FROM borrow_requests
         WHERE id = ?
         FOR UPDATE`,
        [requestId]
      );

      if (requestRows.length === 0) {
        throw new BorrowRequestError(404, 'Borrow request not found.');
      }

      const requestRow = requestRows[0] as RowDataPacket & {
        id: number;
        postId: number;
        ownerId: number;
        borrowerId: number;
        status: BorrowRequestStatus;
      };

      if (requestRow.ownerId !== ownerId) {
        throw new BorrowRequestError(403, 'Only the owner can decline this request.');
      }

      if (requestRow.status !== 'pending') {
        throw new BorrowRequestError(400, 'This request is no longer available.');
      }

      await connection.query<ResultSetHeader>(
        `UPDATE borrow_requests
         SET status = 'declined'
         WHERE id = ?`,
        [requestId]
      );

      await connection.query<ResultSetHeader>(
        `UPDATE posts
         SET status = ?
         WHERE id = ?`,
        ['available', requestRow.postId]
      );

      await connection.query<ResultSetHeader>(
        `INSERT INTO borrow_notifications (request_id, recipient_id, actor_id, type)
         VALUES (?, ?, ?, 'request-declined')`,
        [requestId, requestRow.borrowerId, ownerId]
      );

      const request = await getRequestById(requestId, connection);

      await connection.commit();
      return {
        request,
        post: {
          id: requestRow.postId,
          status: 'available'
        }
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async getNotificationsForUser(userId: number) {
    await pool.query<ResultSetHeader[]>(
      `INSERT INTO borrow_notifications (request_id, recipient_id, actor_id, type)
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
         AND bn.id IS NULL`,
      [userId]
    );

    const [rows] = await pool.query<BorrowNotificationRow[]>(
      `${notificationSelect}
       WHERE bn.recipient_id = ?
         AND (
           bn.type <> 'incoming-request'
           OR (
             br.status = 'pending'
             AND p.status <> 'borrowed'
           )
         )
       ORDER BY bn.created_at DESC, bn.id DESC`,
      [userId]
    );

    return rows.map(mapNotificationRow);
  },

  async getBorrowedItemsForUser(userId: number) {
    const [rows] = await pool.query<BorrowedItemRow[]>(
      `SELECT br.id AS requestId,
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
       ORDER BY br.approved_at DESC, br.id DESC`,
      [userId]
    );

    return rows.map(mapBorrowedItemRow);
  },

  async getLentItemsForUser(userId: number) {
    const [rows] = await pool.query<LentItemRow[]>(
      `SELECT br.id AS requestId,
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
       ORDER BY br.approved_at DESC, br.id DESC`,
      [userId]
    );

    return rows.map(mapLentItemRow);
  }
};