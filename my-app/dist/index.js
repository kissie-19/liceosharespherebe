import dotenv from 'dotenv';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import bcrypt from 'bcryptjs';
dotenv.config();
import pool from './config/db.js';
import authRoute from './routes/auth.route.js';
import borrowRequestRoute from './routes/borrow-request.route.js';
import systemNotificationRoute from './routes/system-notification.route.js';
import forgotRoute from './routes/forgot.route.js';
import resetRoute from './routes/reset.route.js';
import postRoute from './routes/post.route.js'; // 🔹 add this
import messageRoute from './routes/message.route.js';
const app = new Hono();
// Apply CORS before routes
app.use('*', cors({
    origin: (origin) => {
        const allowedOrigins = new Set([
            'http://localhost:4200',
            'http://127.0.0.1:4200'
        ]);
        if (!origin || allowedOrigins.has(origin)) {
            return origin;
        }
        return null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true
}));
const ADMIN_EMAIL = 'npacatang89487@liceo.edu.ph';
const ADMIN_PASSWORD = 'admin123123';
async function ensureAdminUser() {
    try {
        const [rows] = await pool.query('SELECT id FROM register WHERE email = ?', [ADMIN_EMAIL]);
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
        if (rows.length === 0) {
            await pool.query('INSERT INTO register (fullname, email, sex, department, contact_number, password) VALUES (?, ?, ?, ?, ?, ?)', ['Admin', ADMIN_EMAIL, 'Male', 'College of Information Technology', '09123456789', hashedPassword]);
            console.log('Admin account created:', ADMIN_EMAIL);
            return;
        }
        await pool.query('UPDATE register SET password = ? WHERE email = ?', [hashedPassword, ADMIN_EMAIL]);
        console.log('Admin account password updated:', ADMIN_EMAIL);
    }
    catch (error) {
        console.error('Failed to ensure admin account:', error);
    }
}
// Mount routes
app.route('/api/auth', forgotRoute); // forgot password
app.route('/api/auth', resetRoute); // reset password
app.route('/posts', postRoute); // 🔹 mount posts route
app.route('/auth', authRoute);
app.route('/auth/borrow-requests', borrowRequestRoute);
app.route('/auth/system-notifications', systemNotificationRoute);
app.route('/auth/messages', messageRoute);
// Test route
app.get('/', (c) => c.text('Hello Hono!'));
(async () => {
    await ensureAdminUser();
    const port = Number(process.env.PORT) || 3000;
    serve({
        fetch: app.fetch,
        port
    }, (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
    });
})();
