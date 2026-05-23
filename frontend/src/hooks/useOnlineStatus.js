// Online status utilities - WebSocket disabled for performance
import { useState, useEffect, useCallback } from 'react';

export function useOnlineStatus(token) {
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // WebSocket disabled - was causing 404 errors and timeouts
  useEffect(() => {
    setOnlineUsers(new Set());
  }, [token]);

  const isUserOnline = useCallback((userId) => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  return {
    onlineUsers,
    isUserOnline
  };
}

export function OnlineIndicator({ userId, onlineUsers }) {
  const isOnline = onlineUsers.has(userId);
  
  return (
    <div 
      className={`inline-block w-3 h-3 rounded-full ${
        isOnline ? 'bg-green-500' : 'bg-gray-300'
      }`} 
      title={isOnline ? 'Online' : 'Offline'} 
    />
  );
}
