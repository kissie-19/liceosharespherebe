import { Hono } from "hono";
import { sendOtp, verifyOtp } from "../controllers/otp.controller.js";

const otpRoute = new Hono(); 

otpRoute.post('/send', sendOtp);
otpRoute.post('/verify', verifyOtp);

export default otpRoute;