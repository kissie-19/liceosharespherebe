import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import authRoute from './routes/auth.route.js';
import borrowRequestRoute from './routes/borrow-request.route.js';

import forgotRoute from './routes/forgot.route.js'
import resetRoute from './routes/reset.route.js'
import postRoute from './routes/post.route.js'   // 🔹 add this
import messageRoute from './routes/message.route.js'

const app = new Hono()



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
}))

// Mount routes
app.route('/api/auth', forgotRoute) // forgot password
app.route('/api/auth', resetRoute)  // reset password
app.route('/posts', postRoute)      // 🔹 mount posts route
app.route('/auth', authRoute);
app.route('/auth/borrow-requests', borrowRequestRoute);
app.route('/auth/messages', messageRoute);
// Test route
app.get('/', (c) => c.text('Hello Hono!'))

// Start server
serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
