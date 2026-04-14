import { Hono } from 'hono';
import { register, login } from '../controllers/register.controller.js';
const router = new Hono();
router.post('/register', register);
router.post('/login', login);
export default router;
