"use client";
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
const socket = io("http://localhost:3002");
export default function App() {
  const canvasRef = useRef(null);
  const frameQueueRef = useRef([]);
  const isRenderingRef = useRef(false);
  useEffect(() => {
    socket.on("reply", (imageUrls) => {
      console.log("Received images:", imageUrls);
      imageUrls.forEach((url) => {
        const img = new Image();
        img.onload = () => frameQueueRef.current.push(img);
        img.src = url;
      });
    });
    socket.on("end-of-stream", () => {
      console.log("All images sent");
    });
    return () => {
      socket.disconnect();
    };
  }, []);
  // Auto-fetch next batch if queue is low
  useEffect(() => {
    const interval = setInterval(() => {
      if (frameQueueRef.current.length < 3) {
        socket.emit("next-batch");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  // Render loop
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    const render = () => {
      if (frameQueueRef.current.length > 0) {
        const img = frameQueueRef.current.shift();
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0, 640, 480);
      }
      requestAnimationFrame(render);
    };
    if (!isRenderingRef.current) {
      isRenderingRef.current = true;
      render();
    }
  }, []);
  const startStreaming = () => {
    socket.emit("newMessage");
  };
  return (
    <div className="p-4">
      <h1 className="text-lg font-bold mb-2">Video Player</h1>
      <canvas ref={canvasRef} width={640} height={480} className="border" />
      <button onClick={startStreaming} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
        PLay
      </button>
    </div>
  );
}









