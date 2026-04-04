import { Hono } from "hono";
import { register, login } from "../controllers/register.controller.js";
const route = new Hono();
route.post("/register", register);
route.post("/login", login);
export default route;
