import { Hono } from 'hono';
import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
const resetRoute = new Hono();
// POST /api/auth/reset-password
resetRoute.post('/reset-password', async (c) => {
    try {
        const { email, code, newPassword } = await c.req.json();
        // Verify OTP exists and is not expired
        const [otpRows] = await pool.query('SELECT * FROM forgot_password WHERE email = ? AND code = ?', [email, code]);
        const otps = otpRows;
        if (otps.length === 0) {
            return c.json({ message: 'Invalid or expired OTP!' }, 401);
        }
        const otp = otps[0];
        if (new Date() > new Date(otp.expires_at)) {
            return c.json({ message: 'OTP has expired!' }, 401);
        }
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        // Update password in register table
        await pool.query('UPDATE register SET password = ? WHERE email = ?', [hashedPassword, email]);
        // Delete used OTP
        await pool.query('DELETE FROM forgot_password WHERE email = ? AND code = ?', [email, code]);
        return c.json({ message: 'Password reset successfully!' });
    }
    catch (err) {
        return c.json({ message: 'Failed to reset password', error: err.message }, 500);
    }
});
export default resetRoute;
