import { PostModel } from '../models/post.model.js';
import pool from '../config/db.js';
import type { Context } from 'hono';

const ADMIN_EMAIL = 'npacatang89487@liceo.edu.ph';

export const PostController = {
  async addPost(c: Context) {
    try {
      const { userId, user_id, itemName, description, attachment, status } = await c.req.json();
      const normalizedUserId = Number(userId ?? user_id);

      // 🔎 Debug log: shows what Angular sends
      console.log('Incoming post:', { userId: normalizedUserId, itemName, description, attachment, status });

      if (!normalizedUserId || Number.isNaN(normalizedUserId)) {
        return c.json({ message: 'User id is required' }, 400);
      }

      if (!itemName || !description) {
        return c.json({ message: 'Item name and description are required' }, 400);
      }

      try {
        const post = await PostModel.create(normalizedUserId, itemName, description, attachment, status ?? 'available');
        return c.json({ message: 'Post added successfully!', post }, 201);
      } catch (dbErr: any) {
        // 🔎 Log full MySQL error
        console.error('DB insert error:', dbErr);
        return c.json({ message: 'Failed to add post', error: dbErr.message }, 500);
      }
    } catch (err: any) {
      console.error('Controller error:', err);
      return c.json({ message: 'Failed to add post', error: err.message }, 500);
    }
  },

  async getPosts(c: Context) {
    try {
      const posts = await PostModel.findAll();
      console.log('Fetched posts:', posts);
      c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      c.header('Pragma', 'no-cache');
      c.header('Expires', '0');
      return c.json(posts);
    } catch (err: any) {
      console.error('DB fetch error:', err);
      return c.json({ message: 'Failed to fetch posts', error: err.message }, 500);
    }
  },

  async updatePost(c: Context) {
    try {
      const postId = Number(c.req.param('id'));
      const { userId, user_id, itemName, description, attachment, status } = await c.req.json();
      const normalizedUserId = Number(userId ?? user_id);

      if (!postId || Number.isNaN(postId)) {
        return c.json({ message: 'Post id is required' }, 400);
      }

      if (!normalizedUserId || Number.isNaN(normalizedUserId)) {
        return c.json({ message: 'User id is required' }, 400);
      }

      if (!itemName || !description) {
        return c.json({ message: 'Item name and description are required' }, 400);
      }

      const post = await PostModel.updateOwnedPost(postId, normalizedUserId, itemName, description, status, attachment);

      if (!post) {
        return c.json({ message: 'Post not found or not owned by user' }, 404);
      }

      return c.json({ message: 'Post updated successfully', post });
    } catch (err: any) {
      console.error('DB update error:', err);
      return c.json({ message: 'Failed to update post', error: err.message }, 500);
    }
  },

  async deletePost(c: Context) {
    try {
      const postId = Number(c.req.param('id'));
      const body = await c.req.json().catch(() => ({}));
      const normalizedUserId = Number(body?.userId ?? body?.user_id);

      if (!postId || Number.isNaN(postId)) {
        return c.json({ message: 'Post id is required' }, 400);
      }

      if (!normalizedUserId || Number.isNaN(normalizedUserId)) {
        return c.json({ message: 'User id is required' }, 400);
      }

      const [userRows] = await pool.query<any[]>(
        'SELECT email FROM register WHERE id = ?',
        [normalizedUserId]
      );

      if (!userRows.length) {
        return c.json({ message: 'Invalid user' }, 401);
      }

      const email = userRows[0].email;
      const isAdmin = String(email).toLowerCase() === ADMIN_EMAIL;

      const post = await PostModel.findById(postId);
      if (!post) {
        return c.json({ message: 'Post not found' }, 404);
      }

      if (isAdmin && Number(post.user_id) && Number(post.user_id) !== normalizedUserId) {
        await PostModel.createSystemNotification(
          postId,
          Number(post.user_id),
          normalizedUserId,
          'Your post has been removed as it violates the community regulations.'
        );
      }

      const deleted = await PostModel.deletePost(postId, normalizedUserId, isAdmin);

      if (!deleted) {
        return c.json({ message: 'Post not found or not authorized to delete' }, 404);
      }

      return c.json({ message: 'Post deleted successfully' });
    } catch (err: any) {
      console.error('DB delete error:', err);
      return c.json({ message: 'Failed to delete post', error: err.message }, 500);
    }
  }
};
