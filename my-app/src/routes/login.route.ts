import { Hono } from 'hono'
import pool from '../config/db.js'
import bcrypt from 'bcryptjs'

const loginRoute = new Hono()

// POST /auth/login
loginRoute.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json()

    // Find user
    const [rows] = await pool.query('SELECT * FROM register WHERE email = ?', [email])
    const users = rows as any[]
    if (users.length === 0) {
      return c.json({ message: 'User not found!' }, 404)
    }

    const user = users[0]

    // Compare password with hashed password
    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      return c.json({ message: 'Invalid credentials!' }, 401)
    }

    // ✅ Return user details for Angular
    return c.json({
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      role: user.role
    })
  } catch (err: any) {
    return c.json({ message: 'Login failed', error: err.message }, 500)
  }
})

export default loginRoute
