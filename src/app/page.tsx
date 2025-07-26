"use client";
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
const socket = io("http://localhost:3002", { autoConnect: false });
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const frameCountRef = useRef(0);
  const currentIndexRef = useRef(0);
  const [frameCount, setFrameCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafId = useRef<number | null>(null);
  // :arrow_down: Draw frame without re-render
  const drawFrame = (index: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = framesRef.current[index];
    if (!canvas || !ctx || !img) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (sliderRef.current) {
      sliderRef.current.value = index.toString();
    }
  };
  // :arrow_down: Receive images from server
  useEffect(() => {
    socket.on("reply", (imageDataUrls: string[]) => {
      imageDataUrls.forEach((base64) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
          framesRef.current.push(img);
          frameCountRef.current++;
          setFrameCount(frameCountRef.current); // one-time update for UI
        };
      });
    });
    socket.on("end-of-stream", () => {
      console.log("All images sent");
      socket.disconnect();
    });
    return () => {
      socket.disconnect();
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);
  // :arrow_down: Frame buffer check
  useEffect(() => {
    const interval = setInterval(() => {
      if (
        frameCountRef.current - currentIndexRef.current < 10 &&
        isPlaying
      ) {
        socket.emit("next-batch");
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying]);
  // :arrow_down: Animation Loop
  const play = () => {
    const baseFrameDuration = 1000 / 30;
    let lastFrameTime = performance.now();
    const step = (time: number) => {
      if (!isPlaying) return;
      if (time - lastFrameTime >= baseFrameDuration / speed) {
        if (currentIndexRef.current < frameCountRef.current - 1) {
          currentIndexRef.current++;
          drawFrame(currentIndexRef.current);
        }
        lastFrameTime = time;
      }
      rafId.current = requestAnimationFrame(step);
    };
    rafId.current = requestAnimationFrame(step);
  };
  // ⬇️ Control animation start/stop
  useEffect(() => {
    if (isPlaying) play();
    else if (rafId.current) cancelAnimationFrame(rafId.current);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [isPlaying, speed]);
  // :arrow_down: Start streaming
  const startStreaming = () => {
    socket.connect();
    socket.emit("newMessage");
    setIsPlaying(true);
  };
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value);
    currentIndexRef.current = index;
    drawFrame(index);
  };
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-5">
      <h1 className="text-white text-xl font-semibold mb-3">
        :frame_with_picture: Image Stream Player
      </h1>
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="bg-black rounded shadow-md border border-gray-700"
      />
      <div className="flex items-center gap-4 mt-4 text-white">
        <button
          onClick={() => {
            setIsPlaying(false);
            currentIndexRef.current = Math.max(0, currentIndexRef.current - 1);
            drawFrame(currentIndexRef.current);
          }}
          title="Previous Frame"
        >
          <SkipBack />
        </button>
        <button
          onClick={isPlaying ? () => setIsPlaying(false) : startStreaming}
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause /> : <Play />}
        </button>
        <button
          onClick={() => {
            setIsPlaying(false);
            currentIndexRef.current = Math.min(
              frameCountRef.current - 1,
              currentIndexRef.current + 1
            );
            drawFrame(currentIndexRef.current);
          }}
          title="Next Frame"
        >
          <SkipForward />
        </button>
        <label className="ml-6">
          <span className="text-sm text-white mr-2">Speed:</span>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="bg-neutral-800 text-white px-2 py-1 rounded border border-neutral-700"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
        </label>
      </div>
      <input
        ref={sliderRef}
        type="range"
        min={0}
        max={frameCount > 0 ? frameCount - 1 : 0}
        defaultValue={0}
        onChange={handleSliderChange}
        className="w-[70%] mt-4"
      />
      <p className="text-gray-400 mt-2 text-sm">
        Frame {currentIndexRef.current + 1} / {frameCount}
      </p>
    </div>
  );
}









