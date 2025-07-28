"use client";
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
const socket = io("http://localhost:3002", { autoConnect: false });
export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const slider = useRef<HTMLInputElement>(null);
  const images = useRef<HTMLImageElement[]>([]);
  const totalFrames = useRef(0);
  const currentFrameIndex = useRef(0);
  const loopId = useRef<number | null>(null);
  const waitingImages = useRef<string[]>([]);
  const lastTime = useRef<number>(0);
  const timePerFrame = useRef<number>(1000 / 30);
  const streaming = useRef(false);
  const askedForMore = useRef(false);
  const [frameCount, setFrameCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(0);
  const draw = (index: number) => {
    const ctx = canvas.current?.getContext("2d");
    const img = images.current[index];
    if (!canvas.current || !ctx || !img) return;
    ctx.clearRect(0, 0, canvas.current.width, canvas.current.height);
    ctx.drawImage(img, 0, 0, canvas.current.width, canvas.current.height);
    if (slider.current) slider.current.value = index.toString();
    setCurrent(index);
  };

  const loadImages = () => {
    const list = [...waitingImages.current];
    waitingImages.current = [];
    list.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        images.current.push(img);
        totalFrames.current++;
        setFrameCount(totalFrames.current);
        if (totalFrames.current === 1 && currentFrameIndex.current === 0)
          draw(0);
      };
      img.onerror = () => {
        console.error("Failed to load image:", src);
      };
      img.src = new URL(src, window.location.origin).href;
    });
  };
  const checkAndAsk = () => {
    const left = totalFrames.current - currentFrameIndex.current;
    const min = Math.max(10, Math.ceil(30 * speed));
    if (left < min && streaming.current && !askedForMore.current) {
      askedForMore.current = true;
      socket.emit("next-batch");
      setTimeout(() => (askedForMore.current = false), 100);
    }
  };
  const loop = (time: number) => {
    if (!playing) return;
    const gap = timePerFrame.current / speed;
    if (time - lastTime.current >= gap) {
      const next = currentFrameIndex.current + 1;
      if (next < images.current.length) {
        currentFrameIndex.current = next;
        draw(currentFrameIndex.current);
        lastTime.current = time;
        setLoading(false);
        checkAndAsk();
      } else {
        if (streaming.current) {
          setLoading(true);
          checkAndAsk();
        } else {
          setPlaying(false);
          return;
        }
      }
    }
    loopId.current = requestAnimationFrame(loop);
  };
  useEffect(() => {
    socket.on("reply", (data: string[]) => {
      waitingImages.current.push(...data);
      loadImages();
    });
    socket.on("end-of-stream", () => {
      console.log("Done receiving");
      streaming.current = false;
      socket.disconnect();
    });
    return () => {
      socket.disconnect();
      if (loopId.current) cancelAnimationFrame(loopId.current);
    };
  }, []);
  useEffect(() => {
    if (playing) {
      lastTime.current = performance.now();
      loopId.current = requestAnimationFrame(loop);
    } else {
      if (loopId.current) cancelAnimationFrame(loopId.current);
    }
    return () => {
      if (loopId.current) cancelAnimationFrame(loopId.current);
    };
  }, [playing, speed]);
  useEffect(() => {
    timePerFrame.current = 1000 / 30;
  }, []);
  const start = () => {
    if (streaming.current) {
      setPlaying(true);
      return;
    }
    streaming.current = true;
    setLoading(true);
    socket.connect();
    socket.emit("newMessage");
    const waitForStart = () => {
      if (images.current.length >= 15) {
        setPlaying(true);
        setLoading(false);
      } else if (streaming.current) {
        setTimeout(waitForStart, 50);
      }
    };
    setTimeout(waitForStart, 100);
  };
  const moveSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value);
    if (index >= 0 && index < images.current.length) {
      currentFrameIndex.current = index;
      draw(index);
    }
  };
  const back = () => {
    const was = playing;
    setPlaying(false);
    const newIndex = Math.max(0, currentFrameIndex.current - 1);
    currentFrameIndex.current = newIndex;
    draw(newIndex);
    if (was) setTimeout(() => setPlaying(true), 50);
  };
  const forward = () => {
    const was = playing;
    setPlaying(false);
    const newIndex = Math.min(
      totalFrames.current - 1,
      currentFrameIndex.current + 1
    );
    currentFrameIndex.current = newIndex;
    draw(newIndex);
    if (was) setTimeout(() => setPlaying(true), 50);
  };
  const restart = () => {
    setPlaying(false);
    currentFrameIndex.current = 0;
    if (images.current.length > 0) draw(0);
  };
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-5">
      <h1 className="text-white text-xl font-semibold mb-3">Video Player</h1>
      <canvas
        ref={canvas}
        width={640}
        height={480}
        className="bg-black rounded shadow-md border border-gray-700"
      />
      <div className="flex items-center gap-4 mt-4 text-white">
        <button
          onClick={back}
          disabled={current === 0}
          className="p-2 bg-gray-600 rounded hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous Frame"
        >
          <SkipBack size={20} />
        </button>
        <button
          onClick={playing ? () => setPlaying(false) : start}
          className="px-4 py-2 bg-blue-500 rounded flex items-center gap-4"
          title={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={20} /> : <Play size={20} />}
          {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={forward}
          disabled={current >= frameCount - 1}
          className="p-2 bg-gray-600 rounded hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="Next Frame"
        >
          <SkipForward size={20} />
        </button>
        <button
          onClick={restart}
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
        ref={slider}
        type="range"
        min={0}
        max={frameCount > 0 ? frameCount - 1 : 0}
        value={current}
        onChange={moveSlider}
        className="w-[70%] mt-4"
      />
      <div className="flex items-center gap-4 mt-2 text-sm">
        <p className="text-gray-400">
          Frame {current + 1} / {frameCount}
        </p>
        {frameCount > 0 && (
          <p className="text-gray-500">Buffer: {frameCount - current} frames</p>
        )}
        {loading && <p className="text-yellow-400">Buffering...</p>}
        {!streaming.current && frameCount > 0 && (
          <p className="text-green-400">Completed</p>
        )}
      </div>
    </div>
  );
}
