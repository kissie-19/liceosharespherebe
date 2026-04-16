import type { Context } from "hono";
import pool from "../config/db.js";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import nodemailer from "nodemailer";

// mao ni mag message sa email gamit ang nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'liceosharesphere@gmail.com', 
    pass: 'xbql azyf xwif xrgh'    
  }
});

// send otp
export async function sendOtp(context: Context) {
  try {
    const body = await context.req.json();
    const email = body.email;

    if (!email) return context.json({ message: "Email is required" }, 400);

    // Check if email exists sa User table
    const [users] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM user WHERE email = ?`, [email]
    );

    if (users.length === 0) {
      return context.json({ message: "Email not found" }, 404);
    }

    // Generate 4-digit OTP
    const code = Math.floor(1000 + Math.random() * 9000).toString();

    // Save OTP sa database — expires after 10 minutes
    await pool.query<ResultSetHeader>(
      `INSERT INTO otp (email, code, expires_at) 
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 3 MINUTE))`,
      [email, code]
    );

    // Send email
    await transporter.sendMail({
      from: 'your_email@gmail.com',
      to: email,
      subject: 'VoxLDCU - Password Reset Code',
      html: `
        <h2>Password Reset Code</h2>
        <p>Your OTP code is: <strong>${code}</strong></p>
        <p>This code expires in 3 minutes.</p>
      `
    });

    return context.json({ message: "OTP sent successfully" }, 200);
  } catch (error) {
    console.log(error);
    return context.json({ message: "Internal server error" }, 500);
  }
}

// Verify OTP
export async function verifyOtp(context: Context) {
  try {
    const body = await context.req.json();
    const { email, code } = body;

    if (!email || !code) {
      return context.json({ message: "Email and code are required" }, 400);
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM otp 
       WHERE email = ? AND code = ? AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email, code]
    );

    if (rows.length === 0) {
      return context.json({ message: "Invalid or expired code" }, 400);
    }

    // Delete OTP after successful verification
    await pool.query(`DELETE FROM otp WHERE email = ?`, [email]);

    return context.json({ message: "OTP verified successfully" }, 200);
  } catch (error) {
    console.log(error);
    return context.json({ message: "Internal server error" }, 500);
  }
}