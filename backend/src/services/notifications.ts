import { db } from '../db/client';

let _io: any = null;

export function setIo(io: any) {
  _io = io;
}

export async function createNotification(
  userId: string,
  type: string,
  message: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const rows = await db('notifications')
      .insert({
        user_id: userId,
        type,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
      })
      .returning('*');

    const notif = rows[0];
    if (_io && notif) {
      _io.to(`user:${userId}`).emit('notification', notif);
    }
  } catch {
    // Never let notification failures break game flow
  }
}
