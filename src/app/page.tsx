"use client";
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

// Socket setup
const socket = io("http://localhost:3002", { autoConnect: false });

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const frameCountRef = useRef(0);
  const currentIndexRef = useRef(0);
  const rafId = useRef<number | null>(null);
  const pendingImages = useRef<string[]>([]);
  const lastFrameTimeRef = useRef<number>(0);
  const targetFrameIntervalRef = useRef<number>(1000 / 30); // 30 FPS default
  const isStreamingRef = useRef(false);
  const hasRequestedMoreRef = useRef(false);

  const [frameCount, setFrameCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);

  // 🖼️ Draw specific frame
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
    setCurrentFrame(index);
  };

  const preloadPendingImages = () => {
    const imagesToProcess = [...pendingImages.current];
    pendingImages.current = [];

    imagesToProcess.forEach((base64) => {
      const img = new Image();
      img.onload = () => {
        framesRef.current.push(img);
        frameCountRef.current++;
        setFrameCount(frameCountRef.current);
        
        if (frameCountRef.current === 1 && currentIndexRef.current === 0) {
          drawFrame(0);
        }
      };
      img.onerror = () => {
        console.warn("Failed to load image frame");
      };
      img.src = base64;
    });
  };

  const checkBufferAndRequest = () => {
    const bufferSize = frameCountRef.current - currentIndexRef.current;
    const minBuffer = Math.max(10, Math.ceil(30 * speed)); 
    
    if (bufferSize < minBuffer && isStreamingRef.current && !hasRequestedMoreRef.current) {
      hasRequestedMoreRef.current = true;
      socket.emit("next-batch");
      

      setTimeout(() => {
        hasRequestedMoreRef.current = false;
      }, 100);
    }
  };

  const playLoop = (currentTime: number) => {
    if (!isPlaying) return;


    const frameInterval = targetFrameIntervalRef.current / speed;
    
    if (currentTime - lastFrameTimeRef.current >= frameInterval) {
      const nextIndex = currentIndexRef.current + 1;
      

      if (nextIndex < framesRef.current.length) {
        currentIndexRef.current = nextIndex;
        drawFrame(currentIndexRef.current);
        lastFrameTimeRef.current = currentTime;
        setIsBuffering(false);

        checkBufferAndRequest();
      } else {
        
        if (isStreamingRef.current) {
          setIsBuffering(true);
          checkBufferAndRequest();
        } else {
          setIsPlaying(false);
          return;
        }
      }
    }

    rafId.current = requestAnimationFrame(playLoop);
  };

  useEffect(() => {
    socket.on("reply", (imageDataUrls: string[]) => {
      pendingImages.current.push(...imageDataUrls);
      preloadPendingImages();
    });

    socket.on("end-of-stream", () => {
      console.log("All images sent");
      isStreamingRef.current = false;
      socket.disconnect();
    });

    return () => {
      socket.disconnect();
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  
  useEffect(() => {
    if (isPlaying) {
      lastFrameTimeRef.current = performance.now();
      rafId.current = requestAnimationFrame(playLoop);
    } else {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    }

    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [isPlaying, speed]);

  // Update target frame interval when speed changes
  useEffect(() => {
    targetFrameIntervalRef.current = 1000 / 30; // Base 30 FPS
  }, []);

  // 🎬 Start stream with intelligent pre-buffering
  const startStreaming = () => {
    if (isStreamingRef.current) {
      // Already streaming, just start/resume playback
      setIsPlaying(true);
      return;
    }

    isStreamingRef.current = true;
    setIsBuffering(true);
    socket.connect();
    socket.emit("newMessage");

    // Start playback when we have enough frames buffered
    const checkBuffer = () => {
      const minStartBuffer = 15; // Start playing when we have 15 frames
      if (framesRef.current.length >= minStartBuffer) {
        setIsPlaying(true);
        setIsBuffering(false);
      } else if (isStreamingRef.current) {
        setTimeout(checkBuffer, 50);
      }
    };

    setTimeout(checkBuffer, 100);
  };

  // ↔️ Slider with smooth seeking
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value);
    if (index >= 0 && index < framesRef.current.length) {
      currentIndexRef.current = index;
      drawFrame(index);
    }
  };

  // 🎮 Frame navigation
  const previousFrame = () => {
    const wasPlaying = isPlaying;
    setIsPlaying(false);
    
    const newIndex = Math.max(0, currentIndexRef.current - 1);
    currentIndexRef.current = newIndex;
    drawFrame(newIndex);
    
    if (wasPlaying) {
      setTimeout(() => setIsPlaying(true), 50);
    }
  };

  const nextFrame = () => {
    const wasPlaying = isPlaying;
    setIsPlaying(false);
    
    const newIndex = Math.min(frameCountRef.current - 1, currentIndexRef.current + 1);
    currentIndexRef.current = newIndex;
    drawFrame(newIndex);
    
    if (wasPlaying) {
      setTimeout(() => setIsPlaying(true), 50);
    }
  };

  // 🎯 Reset and restart
  const resetPlayer = () => {
    setIsPlaying(false);
    currentIndexRef.current = 0;
    if (framesRef.current.length > 0) {
      drawFrame(0);
    }
  };

  // 🖥️ UI
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-5">
      <h1 className="text-white text-xl font-semibold mb-3">
        Video Playerr
      </h1>

      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="bg-black rounded shadow-md border border-gray-700"
      />

      <div className="flex items-center gap-4 mt-4 text-white">
        <button
          onClick={previousFrame}
          disabled={currentFrame === 0}
          className="p-2 bg-gray-600 rounded hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous Frame"
        >
          <SkipBack size={20} />
        </button>

        <button
          onClick={isPlaying ? () => setIsPlaying(false) : startStreaming}
          className="px-4 py-2 bg-blue-500 rounded flex items-center gap-4"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          {isPlaying ? "Pause" : "Play"}
        </button>

        <button
          onClick={nextFrame}
          disabled={currentFrame >= frameCount - 1}
          className="p-2 bg-gray-600 rounded hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="Next Frame"
        >
          <SkipForward size={20} />
        </button>

        <button
          onClick={resetPlayer}
          className="px-3 py-2 bg-gray-600 rounded hover:bg-gray-700 transition text-sm"
          title="Reset to beginning"
        >
          Reset
        </button>

        <label className="ml-6">
          <span className="text-sm text-gray-300 mr-2">Speed:</span>
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
        value={currentFrame}
        onChange={handleSliderChange}
        className="w-[70%] mt-4"
      />

      <div className="flex items-center gap-4 mt-2 text-sm">
        <p className="text-gray-400">
          Frame {currentFrame + 1} / {frameCount}
        </p>
        
        {frameCount > 0 && (
          <p className="text-gray-500">
            Buffer: {frameCount - currentFrame} frames
          </p>
        )}
        
        {isBuffering && (
          <p className="text-yellow-400 animate-pulse">
            Buffering...
          </p>
        )}
        
        {!isStreamingRef.current && frameCount > 0 && (
          <p className="text-green-400">
            Completed
          </p>
        )}
      </div>
    </div>
  );
}