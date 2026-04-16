import { Hono } from 'hono'
import { register, login, checkEmail, resetPassword } from '../controllers/register.controller.js'

const router = new Hono()

router.post('/register', register)
router.post('/login', login)
router.post("/reset-password", resetPassword);
router.post("/check-email", checkEmail);


export default router

