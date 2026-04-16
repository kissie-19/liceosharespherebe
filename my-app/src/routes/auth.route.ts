import { Hono } from 'hono';
import type { Context } from 'hono';
import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import { PostModel } from '../models/post.model.js';

const authRoute = new Hono();

const isBcryptHash = (value: unknown): value is string => {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
};

const toStorageSafeProfilePicture = (value: unknown) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  // Inline base64 images can easily exceed localStorage limits when the frontend
  // persists the login response as the current user.
  if (normalizedValue.startsWith('data:')) {
    return null;
  }

  return normalizedValue;
};

const buildStorageSafeUser = (user: any) => {
  const profilePicture = toStorageSafeProfilePicture(user.profile_picture ?? user.profilePicture);

  return {
    id: user.id,
    fullname: user.fullname,
    sex: user.sex,
    department: user.department,
    contact_number: user.contact_number,
    email: user.email,
    profile_picture: profilePicture,
    profilePicture,
    hasProfilePicture: Boolean(user.profile_picture ?? user.profilePicture)
  };
};

// REGISTER (Sign Up)
authRoute.post('/register', async (c) => {
  const body = await c.req.json();
  const { fullname, email, sex, department, contact_number, password } = body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO register (fullname, email, sex, department, contact_number, password) VALUES (?, ?, ?, ?, ?, ?)',
      [fullname, email, sex, department, contact_number, hashedPassword]
    );

    return c.json({ message: 'User registered successfully!' });
  } catch (err: any) {
    return c.json({ message: 'Failed to register user', error: err.message }, 500);
  }
});

// LOGIN (Sign In)
authRoute.post('/login', async (c) => {
  const body = await c.req.json();
  const { email, password } = body;

  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM register WHERE email = ?', [email]);
    if (rows.length === 0) {
      return c.json({ message: 'Invalid email or password.' }, 401);
    }

    const user = rows[0];
    const storedPassword = String(user.password ?? '');
    const isLegacyPlainTextPassword = !isBcryptHash(storedPassword);
    const isMatch = isLegacyPlainTextPassword
      ? password === storedPassword
      : await bcrypt.compare(password, storedPassword);

    if (!isMatch) {
      return c.json({ message: 'Invalid email or password.' }, 401);
    }

    if (isLegacyPlainTextPassword) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query('UPDATE register SET password = ? WHERE id = ?', [hashedPassword, user.id]);
    }

    // ✅ Return profile info but exclude password
    return c.json({
      message: 'Login successful',
      user: buildStorageSafeUser(user)
    });
  } catch (err: any) {
    return c.json({ message: 'Login failed', error: err.message }, 500);
  }
});

// GET PROFILE
authRoute.get('/profile/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const [rows] = await pool.query<any[]>(
      'SELECT id, fullname, sex, department, contact_number, email, profile_picture, profile_picture AS profilePicture FROM register WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return c.json({ message: 'User not found' }, 404);
    }

    const user = rows[0];
    // ✅ No password returned
    return c.json(user);
  } catch (err: any) {
    return c.json({ message: 'Failed to fetch profile', error: err.message }, 500);
  }
});

const updateProfileHandler = async (c: Context) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { fullname, email, sex, department, contact_number, profile_picture, profilePicture } = body;

  try {
    const [existingRows] = await pool.query<any[]>(
      'SELECT id, fullname, sex, department, contact_number, email, profile_picture FROM register WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return c.json({ message: 'Profile not found' }, 404);
    }

    const existingUser = existingRows[0];

    const nextFullname = fullname ?? existingUser.fullname;
    const nextEmail = email ?? existingUser.email;
    const nextSex = sex ?? existingUser.sex;
    const nextDepartment = department ?? existingUser.department;
    const nextContactNumber = contact_number ?? existingUser.contact_number;
    const nextProfilePicture = profile_picture ?? profilePicture ?? existingUser.profile_picture;

    await pool.query(
      'UPDATE register SET fullname=?, email=?, sex=?, department=?, contact_number=?, profile_picture=? WHERE id=?',
      [nextFullname, nextEmail, nextSex, nextDepartment, nextContactNumber, nextProfilePicture, id]
    );

    // ✅ Return the updated profile object
    const [rows] = await pool.query<any[]>(
      'SELECT id, fullname, sex, department, contact_number, email, profile_picture, profile_picture AS profilePicture FROM register WHERE id=?',
      [id]
    );

    if (rows.length > 0) {
      return c.json(rows[0]);
    } else {
      return c.json({ message: 'Profile not found' }, 404);
    }
  } catch (err: any) {
    return c.json({ message: 'Failed to update profile', error: err.message }, 500);
  }
};

// UPDATE PROFILE
authRoute.put('/profile/:id', updateProfileHandler);
authRoute.patch('/profile/:id', updateProfileHandler);

// ADD POST
authRoute.post('/posts', async (c) => {
  const body = await c.req.json();
  const { userId, user_id, itemName, description, attachment, status } = body;
  const normalizedUserId = Number(userId ?? user_id);

  try {
    if (!normalizedUserId || Number.isNaN(normalizedUserId)) {
      return c.json({ message: 'User id is required' }, 400);
    }

    if (!itemName || !description) {
      return c.json({ message: 'Item name and description are required' }, 400);
    }

    const post = await PostModel.create(normalizedUserId, itemName, description, attachment, status ?? 'available');
    return c.json({ message: 'Post added successfully!', post }, 201);
  } catch (err: any) {
    return c.json({ message: 'Failed to add post', error: err.message }, 500);
  }
});

// GET ALL POSTS (with owner info)
authRoute.get('/posts', async (c) => {
  try {
    const posts = await PostModel.findAll();
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
    return c.json(posts);
  } catch (err: any) {
    return c.json({ message: 'Failed to fetch posts', error: err.message }, 500);
  }
});

authRoute.put('/posts/:id', async (c) => {
  const postId = Number(c.req.param('id'));
  const body = await c.req.json();
  const { userId, user_id, itemName, description, attachment, status } = body;
  const normalizedUserId = Number(userId ?? user_id);

  try {
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
    return c.json({ message: 'Failed to update post', error: err.message }, 500);
  }
});

const ADMIN_EMAIL = 'npacatang89487@liceo.edu.ph';

authRoute.delete('/posts/:id', async (c) => {
  const postId = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const normalizedUserId = Number(body?.userId ?? body?.user_id);

  try {
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

    const email = String(userRows[0].email || '').toLowerCase();
    const isAdmin = email === ADMIN_EMAIL;
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
    return c.json({ message: 'Failed to delete post', error: err.message }, 500);
  }
});

export default authRoute;
