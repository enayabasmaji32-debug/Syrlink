// Online status utilities with real WebSocket connection
import { useState, useEffect, useCallback, useRef } from 'react';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/api/ws/online';

export function useOnlineStatus() {
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [notifications, setNotifications] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      // Authentication is handled via httpOnly cookie in the handshake
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'status_change') {
          setOnlineUsers((prev) => {
            const next = new Set(prev);
            if (msg.status === 'online') {
              next.add(msg.user_id);
            } else {
              next.delete(msg.user_id);
            }
            return next;
          });
        } else if (msg.type === 'notification') {
          setNotifications((prev) => [msg.data, ...prev]);
        } else if (msg.type === 'notifications') {
          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const newItems = msg.data.filter((n) => !existingIds.has(n.id));
            return [...newItems, ...prev];
          });
        }
      } catch (e) {
        console.warn('[WebSocket] Invalid message', e);
      }
    };

    ws.onerror = (e) => {
      console.warn('[WebSocket] error', e);
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping');
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  }, []);

  const isUserOnline = useCallback((userId) => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  return {
    onlineUsers,
    isUserOnline,
    ws: wsRef.current,
    notifications,
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
