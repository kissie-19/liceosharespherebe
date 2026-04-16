import type { Context } from "hono";
import pool from "../config/db.js";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'liceosharesphere@gmail.com', 
    pass: 'xbql azyf xwif xrgh'    
  }
});

export async function sendOtp(context: Context) {
  try {
    const body = await context.req.json();
    const email = body.email;

    if (!email) return context.json({ message: "Email is required" }, 400);

    const [users] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM register WHERE email = ?`, [email]
    );

    if (users.length === 0) {
      return context.json({ message: "Email not found" }, 404);
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await pool.query<ResultSetHeader>(
      `INSERT INTO otp (email, code, expires_at) 
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 3 MINUTE))`,
      [email, code]
    );

    await transporter.sendMail({
      from: 'voxldcu@gmail.com',
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

    // ✅ I-delete na dito pagka-verify
    await pool.query(`DELETE FROM otp WHERE email = ?`, [email]);

    return context.json({ message: "OTP verified successfully" }, 200);
  } catch (error) {
    console.log(error);
    return context.json({ message: "Internal server error" }, 500);
  }
}