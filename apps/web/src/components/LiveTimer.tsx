import React, { useEffect, useState } from "react";

interface LiveTimerProps {
  /** ISO timestamp the timer counts UP from (elapsed since this moment). Required when `countdownTo` is not provided. */
  createdAt?: string;
  /** ISO timestamp the timer counts DOWN to (remaining until this moment). Takes precedence over `createdAt`. */
  countdownTo?: string;
  render?: (props: { time: string; expired: boolean }) => React.ReactNode;
}

export const LiveTimer: React.FC<LiveTimerProps> = ({ createdAt, countdownTo, render }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      if (countdownTo) {
        const target = new Date(countdownTo).getTime();
        if (Number.isNaN(target)) {
          setSeconds(0);
          return;
        }
        setSeconds(Math.max(0, Math.floor((target - now) / 1000)));
      } else if (createdAt) {
        const start = new Date(createdAt).getTime();
        setSeconds(Math.max(0, Math.floor((now - start) / 1000)));
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [createdAt, countdownTo]);

  const formatTime = (totalSeconds: number): string => {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (days > 0) {
      return `${days}d ${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const timeStr = formatTime(seconds);
  const expired = countdownTo ? seconds <= 0 : seconds > 90;

  if (render) {
    return <>{render({ time: timeStr, expired })}</>;
  }

  return <>{timeStr}</>;
};
