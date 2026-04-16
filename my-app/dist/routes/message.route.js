import { Hono } from 'hono';
import { MessageCrypto, MessageModel } from '../models/message.model.js';
const messageRoute = new Hono();
const parseRequiredNumber = (value, fieldName) => {
    const normalizedValue = Number(value);
    if (!normalizedValue || Number.isNaN(normalizedValue)) {
        throw new Error(`${fieldName} is required.`);
    }
    return normalizedValue;
};
messageRoute.get('/conversations', async (c) => {
    try {
        const userId = parseRequiredNumber(c.req.query('userId'), 'User id');
        const conversations = await MessageModel.getConversationsForUser(userId);
        return c.json({ conversations });
    }
    catch (error) {
        return c.json({ message: error instanceof Error ? error.message : 'Failed to get conversations.' }, 400);
    }
});
messageRoute.get('/thread', async (c) => {
    try {
        const userId = parseRequiredNumber(c.req.query('userId'), 'User id');
        const otherUserId = parseRequiredNumber(c.req.query('otherUserId'), 'Other user id');
        const messages = await MessageModel.getThread(userId, otherUserId);
        return c.json({ messages });
    }
    catch (error) {
        return c.json({ message: error instanceof Error ? error.message : 'Failed to get thread.' }, 400);
    }
});
messageRoute.get('/unread-count', async (c) => {
    try {
        const userId = parseRequiredNumber(c.req.query('userId'), 'User id');
        const unreadCount = await MessageModel.getUnreadCountForUser(userId);
        return c.json({ unreadCount });
    }
    catch (error) {
        return c.json({ message: error instanceof Error ? error.message : 'Failed to get unread count.' }, 400);
    }
});
messageRoute.post('/', async (c) => {
    try {
        const body = await c.req.json();
        const senderId = parseRequiredNumber(body.senderId, 'Sender id');
        const receiverId = parseRequiredNumber(body.receiverId, 'Receiver id');
        const messageText = String(body.messageText ?? '').trim();
        const message = await MessageModel.sendMessage(senderId, receiverId, messageText);
        return c.json({ message }, 201);
    }
    catch (error) {
        console.error('Message send failed:', error);
        return c.json({ message: error instanceof Error ? error.message : 'Failed to send message.' }, 400);
    }
});
messageRoute.post('/verify', async (c) => {
    try {
        const body = await c.req.json();
        const messageText = String(body.messageText ?? '').trim();
        if (!messageText) {
            throw new Error('messageText is required.');
        }
        const encrypted = MessageCrypto.encryptText(messageText);
        const decrypted = MessageCrypto.decryptText(encrypted);
        return c.json({ messageText, encrypted, decrypted });
    }
    catch (error) {
        return c.json({ message: error instanceof Error ? error.message : 'Failed to verify encryption.' }, 400);
    }
});
messageRoute.patch('/thread/read', async (c) => {
    try {
        const body = await c.req.json();
        const userId = parseRequiredNumber(body.userId, 'User id');
        const otherUserId = parseRequiredNumber(body.otherUserId, 'Other user id');
        const updatedCount = await MessageModel.markThreadAsRead(userId, otherUserId);
        return c.json({ updatedCount });
    }
    catch (error) {
        return c.json({ message: error instanceof Error ? error.message : 'Failed to mark thread as read.' }, 400);
    }
});
export default messageRoute;
