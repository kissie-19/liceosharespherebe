import { Hono } from 'hono';
import { BorrowRequestModel } from '../models/borrow-request.model.js';
const borrowRequestRoute = new Hono();
const parseRequiredNumber = (value, fieldName) => {
    const normalizedValue = Number(value);
    if (!normalizedValue || Number.isNaN(normalizedValue)) {
        throw new Error(`${fieldName} is required.`);
    }
    return normalizedValue;
};
const getErrorResponse = (error) => {
    if (BorrowRequestModel.isBorrowRequestError(error)) {
        return {
            status: error.statusCode,
            body: { message: error.message }
        };
    }
    return {
        status: 500,
        body: {
            message: error instanceof Error ? error.message : 'Borrow request operation failed.'
        }
    };
};
borrowRequestRoute.get('/mine', async (c) => {
    try {
        const borrowerId = parseRequiredNumber(c.req.query('borrowerId'), 'Borrower id');
        const requests = await BorrowRequestModel.getRequestsForBorrower(borrowerId);
        return c.json({ requests });
    }
    catch (error) {
        const { status, body } = getErrorResponse(error);
        return c.json(body, status);
    }
});
borrowRequestRoute.get('/incoming', async (c) => {
    try {
        const ownerId = parseRequiredNumber(c.req.query('ownerId'), 'Owner id');
        const requests = await BorrowRequestModel.getPendingRequestsForOwner(ownerId);
        return c.json({ requests });
    }
    catch (error) {
        const { status, body } = getErrorResponse(error);
        return c.json(body, status);
    }
});
borrowRequestRoute.get('/notifications', async (c) => {
    try {
        const userId = parseRequiredNumber(c.req.query('userId'), 'User id');
        const notifications = await BorrowRequestModel.getNotificationsForUser(userId);
        return c.json({ notifications: notifications.map((notification) => ({
                ...notification,
                message: notification.type === 'incoming-request'
                    ? `${notification.actorName} requested to borrow "${notification.itemName}".`
                    : `${notification.actorName} ${notification.type === 'request-approved' ? 'accepted' : 'declined'} your request for "${notification.itemName}".`
            })) });
    }
    catch (error) {
        const { status, body } = getErrorResponse(error);
        return c.json(body, status);
    }
});
borrowRequestRoute.get('/borrowed', async (c) => {
    try {
        const userId = parseRequiredNumber(c.req.query('userId'), 'User id');
        const items = await BorrowRequestModel.getBorrowedItemsForUser(userId);
        return c.json({ items });
    }
    catch (error) {
        const { status, body } = getErrorResponse(error);
        return c.json(body, status);
    }
});
borrowRequestRoute.get('/lent', async (c) => {
    try {
        const userId = parseRequiredNumber(c.req.query('userId'), 'User id');
        const items = await BorrowRequestModel.getLentItemsForUser(userId);
        return c.json({ items });
    }
    catch (error) {
        const { status, body } = getErrorResponse(error);
        return c.json(body, status);
    }
});
borrowRequestRoute.post('/', async (c) => {
    try {
        const body = await c.req.json();
        const postId = parseRequiredNumber(body.postId, 'Post id');
        const ownerId = parseRequiredNumber(body.ownerId, 'Owner id');
        const borrowerId = parseRequiredNumber(body.borrowerId, 'Borrower id');
        const result = await BorrowRequestModel.createRequest(postId, ownerId, borrowerId);
        return c.json(result, 201);
    }
    catch (error) {
        const { status, body } = getErrorResponse(error);
        return c.json(body, status);
    }
});
borrowRequestRoute.patch('/:requestId/approve', async (c) => {
    try {
        const requestId = parseRequiredNumber(c.req.param('requestId'), 'Request id');
        const body = await c.req.json();
        const ownerId = parseRequiredNumber(body.ownerId, 'Owner id');
        const result = await BorrowRequestModel.approveRequest(requestId, ownerId);
        return c.json(result);
    }
    catch (error) {
        const { status, body } = getErrorResponse(error);
        return c.json(body, status);
    }
});
borrowRequestRoute.patch('/:requestId/decline', async (c) => {
    try {
        const requestId = parseRequiredNumber(c.req.param('requestId'), 'Request id');
        const body = await c.req.json();
        const ownerId = parseRequiredNumber(body.ownerId, 'Owner id');
        const result = await BorrowRequestModel.declineRequest(requestId, ownerId);
        return c.json(result);
    }
    catch (error) {
        const { status, body } = getErrorResponse(error);
        return c.json(body, status);
    }
});
export default borrowRequestRoute;
