"use client";
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
const socket = io("http://localhost:3002", { autoConnect: false });
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<HTMLImageElement[]>([]); // Mutable buffer for frames
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);
  const [frameCount, setFrameCount] = useState(0); // Track frame count separately
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafId = useRef<number | null>(null);
  // Receive batches and push images into framesRef
  useEffect(() => {
    socket.on("reply", (imageDataUrls: string[]) => {
      imageDataUrls.forEach((base64) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
          framesRef.current.push(img);
        };
      });
      // Update frame count once per batch
      setFrameCount(framesRef.current.length);
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
  // Request more frames if buffer is low while playing
  useEffect(() => {
    const interval = setInterval(() => {
      if (frameCount - currentIndex < 10 && isPlaying) {
        socket.emit("next-batch");
      }
    }, 500);
    return () => clearInterval(interval);
  }, [currentIndex, isPlaying, frameCount]);
  // Draw current frame on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const img = framesRef.current[currentIndex];
    if (!img) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }, [currentIndex]);
  // Playback using requestAnimationFrame
  const play = () => {
    const baseFrameDuration = 1000 / 30;
    let lastFrameTime = performance.now();
    const step = (time: number) => {
      if (!isPlaying) return;
      if (time - lastFrameTime >= baseFrameDuration / speed) {
        setCurrentIndex((prev) => {
          if (prev < frameCount - 1) return prev + 1;
          return prev;
        });
        lastFrameTime = time;
      }
      rafId.current = requestAnimationFrame(step);
    };
    rafId.current = requestAnimationFrame(step);
  };
  useEffect(() => {
    if (isPlaying) {
      play();
    } else if (rafId.current) {
      cancelAnimationFrame(rafId.current);
    }
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [isPlaying, speed, frameCount]);
  // Sync sliderValue -> currentIndex with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setCurrentIndex(sliderValue);
    }, 50);
    return () => clearTimeout(handler);
  }, [sliderValue]);

  useEffect(() => {
    if (sliderValue !== currentIndex) {
      setSliderValue(currentIndex);
    }
  }, [currentIndex]);
  const startStreaming = () => {
    socket.connect();
    socket.emit("newMessage");
    setIsPlaying(true);
  };
  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
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
            setCurrentIndex((prev) => Math.max(0, prev - 1));
          }}
          title="Previous Frame"
        >
          <SkipBack />
        </button>
        <button
          onClick={isPlaying ? togglePlay : startStreaming}
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause /> : <Play />}
        </button>
        <button
          onClick={() => {
            setIsPlaying(false);
            setCurrentIndex((prev) =>
              Math.min(frameCount - 1, prev + 1)
            );
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
        type="range"
        min={0}
        max={frameCount > 0 ? frameCount - 1 : 0}
        value={sliderValue}
        onChange={(e) => setSliderValue(parseInt(e.target.value))}
        className="w-[70%] mt-4"
      />
      <p className="text-gray-400 mt-2 text-sm">
        Frame {currentIndex + 1} / {frameCount}
      </p>
    </div>
  );
}