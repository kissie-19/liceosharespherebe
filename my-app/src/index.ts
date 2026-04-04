import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import registerRoute from './routes/register.route.js'
import { cors } from 'hono/cors'
const app = new Hono()


app.use(cors({
  origin: 'http://localhost:4200', // Allow all origins
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], // Allowed HTTP methods
  allowHeaders: ['Content-Type', 'Authorization'], 
  exposeHeaders: ['Content-Length'],
  maxAge: 600, // Cache preflight response for 10 minutes
  credentials: true, // Allow cookies and credentials
}))

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.route('/auth', registerRoute)  // mounts POST /auth/register and POST /auth/login

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})