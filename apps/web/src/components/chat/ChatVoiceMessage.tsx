import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatVoiceMessageProps = {
  src: string;
  isOwn: boolean;
  footer?: ReactNode;
};

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const rounded = Math.max(0, Math.floor(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

export function ChatVoiceMessage({
  src,
  isOwn,
  footer,
}: ChatVoiceMessageProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5>(1);
  const bars = useMemo(
    () =>
      Array.from({ length: 34 }, (_, index) => {
        const wave = Math.sin(index * 1.73) * 0.5 + Math.sin(index * 0.47) * 0.5;
        return 7 + Math.round(Math.abs(wave) * 17);
      }),
    [],
  );
  const progress = duration > 0 ? currentTime / duration : 0;

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
  };

  const toggleSpeed = () => {
    const next = speed === 1 ? 1.5 : 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  return (
    <div
      className={cn(
        "w-[min(78vw,22rem)] rounded-2xl px-3 py-2.5 shadow-sm",
        isOwn
          ? "bg-gradient-to-br from-orange-700 to-orange-500 text-white"
          : "bg-[#e8e8eb] text-foreground dark:bg-[#2A2A2C] dark:text-white",
      )}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      />
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => void togglePlayback()}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            isOwn ? "bg-white/20 text-white" : "bg-orange-500 text-white",
          )}
          aria-label={playing ? "Pause voice message" : "Play voice message"}
        >
          {playing ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current" />
          )}
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-[3px]"
          onClick={(event) => {
            const audio = audioRef.current;
            if (!audio || !duration) return;
            const rect = event.currentTarget.getBoundingClientRect();
            audio.currentTime =
              Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) *
              duration;
          }}
          aria-label="Seek voice message"
        >
          {bars.map((height, index) => (
            <span
              key={index}
              className={cn(
                "w-1 rounded-full transition-colors",
                index / bars.length <= progress
                  ? isOwn
                    ? "bg-white"
                    : "bg-orange-500"
                  : isOwn
                    ? "bg-white/35"
                    : "bg-foreground/20",
              )}
              style={{ height }}
            />
          ))}
        </button>
        <button
          type="button"
          onClick={toggleSpeed}
          className={cn(
            "rounded-full px-1.5 py-1 text-[11px] font-bold",
            isOwn ? "bg-white/15" : "bg-background/70",
          )}
          aria-label={`Playback speed ${speed} times`}
        >
          {speed}×
        </button>
      </div>
      <div className="mt-1 flex items-end justify-between gap-2 text-[11px] opacity-75">
        <span>{formatDuration(playing ? currentTime : duration)}</span>
        {footer}
      </div>
    </div>
  );
}
