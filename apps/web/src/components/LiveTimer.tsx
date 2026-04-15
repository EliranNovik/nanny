import React, { useEffect, useState } from "react";

interface LiveTimerProps {
  createdAt: string;
  render?: (props: { time: string; expired: boolean }) => React.ReactNode;
}

export const LiveTimer: React.FC<LiveTimerProps> = ({ createdAt, render }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const update = () => {
      const now = Date.now();
      setElapsed(Math.floor((now - start) / 1000));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const formatElapsedTime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) {
      return `${days}d ${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const timeStr = formatElapsedTime(elapsed);
  const expired = elapsed > 90; // Default threshold

  if (render) {
    return <>{render({ time: timeStr, expired })}</>;
  }

  return <>{timeStr}</>;
};
