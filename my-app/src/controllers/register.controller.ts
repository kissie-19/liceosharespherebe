import type { Context } from "hono";
import pool from "../config/db.js";
import type { ResultSetHeader } from "mysql2";
import type { UserModel, RegisterModel, LoginModel} from "../models/user.model.js"; 

export async function register(context: Context) {
  try {
    const body = await context.req.json();
    console.log("BODY:", body);

    const {
      fullname,
      email,
      sex,
      department,
      contact_number,
      password,
      confirm_password
    } = body;

    // ✅ Validation
    if (!fullname || !email || !sex || !department || !contact_number || !password || !confirm_password) {
      return context.json({ message: "All fields are required" }, 400);
    }

    if (password !== confirm_password) {
      return context.json({ message: "Passwords do not match" }, 400);
    }

    // ✅ Check existing email
    const [existing] = await pool.query(
      `SELECT * FROM register WHERE email = ?`,
      [email]
    );

    if ((existing as any[]).length > 0) {
      return context.json({ message: "Email already registered" }, 400);
    }

    // ✅ Insert (MATCHES YOUR TABLE EXACTLY)
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO register 
      (fullname, email, sex, department, contact_number, password) 
      VALUES (?, ?, ?, ?, ?, ?)`,
      [fullname, email, sex, department, contact_number, password]
    );

    return context.json({ message: "Registered successfully" }, 201);

  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return context.json({ message: "Internal server error" }, 500);
  }
}

export async function login(context: Context) {
  try {const body = await context.req.json();
    
    if (!body.email) {
      return context.json({ message: "Email is required" }, 400);
    }
    if (!body.password) {
      return context.json({ message: "Password is required" }, 400);
    }
    const [rows] = await pool.query<UserModel[]>(
      `SELECT * FROM register WHERE email = ? AND password = ?`,
      [body.email, body.password]
    );

    const user = rows[0];

    if (!user) {
      return context.json({ message: "Invalid email or password" }, 401);
    }

    return context.json({ message: "Login successful" }, 200);return context.json({
      id: user.id,
      full_name: user.full_name,
      student_id: user.student_id,
      email: user.email,
      role: 'student'
    }, 200);

  } catch (error) {
    console.log(error);
    return context.json({ message: "Internal server error" }, 500);
  }
}