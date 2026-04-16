import { Hono } from 'hono';
import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

const resetRoute = new Hono();

resetRoute.post('/reset-password', async (c) => {
  try {
    const { email, newPassword } = await c.req.json(); // ✅ tanggal na ang 'code'

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE register SET password = ? WHERE email = ?',
      [hashedPassword, email]
    );

    return c.json({ message: 'Password reset successfully!' });
  } catch (err: any) {
    return c.json({ message: 'Failed to reset password', error: err.message }, 500);
  }
});

export default resetRoute;