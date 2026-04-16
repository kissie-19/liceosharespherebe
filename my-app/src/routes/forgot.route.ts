import { Hono } from 'hono'
import pool from '../config/db.js'

const forgotRoute = new Hono()

// POST /api/auth/forgot-password
forgotRoute.post('/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json()

    // Check if user exists
    const [user] = await pool.query('SELECT * FROM register WHERE email = ?', [email])
    if ((user as any[]).length === 0) {
      return c.json({ message: 'Email not found!' }, 404)
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Save code
    await pool.query(
      'INSERT INTO forgot_password (email, code, expires_at) VALUES (?, ?, ?)',
      [email, code, expiresAt]
    )

    // Normally send via email, but return for testing
    return c.json({ message: 'OTP generated!', code })
  } catch (err: any) {
    return c.json({ message: 'Failed to process request', error: err.message }, 500)
  }
})

export default forgotRoute

forgotRoute.post('/check-email', async (c) => {
  try {
    const { email } = await c.req.json()
    const [user] = await pool.query('SELECT * FROM register WHERE email = ?', [email])
    if ((user as any[]).length === 0) {
      return c.json({ message: 'Email not found!' }, 404)
    }
    return c.json({ message: 'Email found!' }, 200)
  } catch (err: any) {
    return c.json({ message: 'Failed to process request', error: err.message }, 500)
  }
})
