import type { Hono } from "hono";
import type { Context } from "hono";
import pool from "../config/db.js";
import type { UserModel, RegisterModel, LoginModel } from "../models/user.model.js";
import type { ResultSetHeader } from "mysql2";


export async function register(context: Context) {
    try {
        const body: RegisterModel = await context.req.json();


        if (!body.fullname)
            return context.json({ message: "Full name is required" }, 400
            );

        if (!body.email)
            return context.json({ message: "Email is required" }, 400
            );

        if (!body.sex)
            return context.json({ message: "Sex is required" }, 400
            );

        if (!body.department)
            return context.json({ message: "Department is required" }, 400
            );

        if (!body.contact_number)
            return context.json({ message: "Contact number is required" }, 400
            );

        if (!body.password)
            return context.json({ message: "Password is required" }, 400
            );

        if (!body.confirm_password)
            return context.json({ message: "Confirm password is required" }, 400)
                ;


        if (body.password !== body.confirm_password) {
            return context.json({ message: "Passwords do not match" }, 400);
        }


        const [existing] = await pool.query<UserModel[]>(
            `SELECT id FROM register WHERE email = ?`,
            [body.email]
        );

        if (existing.length > 0) {
            return context.json({ message: "Email already exists" }, 409);
        }

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO register (fullname, email, sex, department, contact_number, password) VALUES (?, ?, ?, ?, ?, ?)`,
            [body.fullname, body.email, body.sex, body.department, body.contact_number, body.password]
        );

        if (result.insertId) {
            const [data] = await pool.query<UserModel[]>(
                `SELECT id, fullname, email, sex, department, contact_number, created_at FROM register WHERE id = ?`,
                [result.insertId]
            );
            return context.json(data[0], 201);
        }

        return context.json({ message: "Failed to create account" }, 400);
    } catch (error) {
        console.log(error);
        return context.json({ message: "Internal server error" }, 500);
    }
}
    export async function login(context: Context) {
        try {
            const body: LoginModel = await context.req.json();

            if (!body.email) return context.json({ message: "Email is required" }, 400
            );
            if (!body.password) return context.json({ message: "Password is required" }, 400
            );
            const [rows] = await pool.query<UserModel[]>(
                `SELECT * FROM User WHERE email = ? AND password = ?`,
                [body.email, body.password]
            );

            const user = rows[0];

            if (!user) {
                return context.json({ message: "Invalid email or password" }, 401);
            }

            return context.json({
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: 'student'
            }, 200);

        } catch (error) {
            console.log(error);
            return context.json({ message: "Internal server error" }, 500);
        }

}
