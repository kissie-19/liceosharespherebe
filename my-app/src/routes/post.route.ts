import { Hono } from 'hono';
import pool from '../config/db.js'
import { PostController } from '../controllers/post.controller.js';

const postRoute = new Hono();

postRoute.post('/', PostController.addPost);
postRoute.get('/', PostController.getPosts);
postRoute.put('/:id', PostController.updatePost);
postRoute.delete('/:id', PostController.deletePost);
postRoute.post('/add', PostController.addPost);
postRoute.get('/all', PostController.getPosts);

export default postRoute;
