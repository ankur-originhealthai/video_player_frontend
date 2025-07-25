'use client';
import { useEffect, useRef } from 'react';
import io from 'socket.io-client';
const useWebSocket = (url, onFrame) => {
  const socketRef = useRef(null);
  useEffect(() => {
    const socket = io(url);
    socketRef.current = socket;
    socket.on('connect', () => {
      console.log('Connected to WebSocket');
    });
    socket.on('reply', (imageUrl) => {
      if (onFrame) {
        onFrame(imageUrl);
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [url, onFrame]);
  const sendMessage = (message) => {
    socketRef.current?.emit('newMessage', message);
  };
  return { sendMessage };
};
export default useWebSocket;