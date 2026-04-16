import { Hono } from 'hono';
import { SystemNotificationModel } from '../models/system-notification.model.js';

const systemNotificationRoute = new Hono();

const parseRequiredNumber = (value: unknown, fieldName: string) => {
  const normalizedValue = Number(value);

  if (!normalizedValue || Number.isNaN(normalizedValue)) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalizedValue;
};

systemNotificationRoute.get('/', async (c) => {
  try {
    const recipientId = parseRequiredNumber(c.req.query('recipientId'), 'Recipient id');
    const notifications = await SystemNotificationModel.getNotificationsForUser(recipientId);
    return c.json({ notifications });
  } catch (error: unknown) {
    return c.json({ message: error instanceof Error ? error.message : 'Failed to load notifications.' }, 400);
  }
});

systemNotificationRoute.delete('/:id', async (c) => {
  try {
    const notificationId = parseRequiredNumber(c.req.param('id'), 'Notification id');
    const recipientId = parseRequiredNumber(c.req.query('recipientId'), 'Recipient id');
    const deleted = await SystemNotificationModel.deleteNotificationForUser(notificationId, recipientId);

    if (!deleted) {
      return c.json({ message: 'Notification not found or not owned by recipient.' }, 404);
    }

    return c.json({ message: 'Notification deleted successfully.' });
  } catch (error: unknown) {
    return c.json({ message: error instanceof Error ? error.message : 'Failed to delete notification.' }, 400);
  }
});

export default systemNotificationRoute;
