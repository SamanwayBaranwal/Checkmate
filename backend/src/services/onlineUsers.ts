// In-memory online user tracking (userId → Set of socketIds)
const onlineUsers = new Map<string, Set<string>>();

export function addOnlineSocket(userId: string, socketId: string) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId)!.add(socketId);
}

export function removeOnlineSocket(userId: string, socketId: string) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) onlineUsers.delete(userId);
}

export function isOnline(userId: string): boolean {
  return (onlineUsers.get(userId)?.size ?? 0) > 0;
}
