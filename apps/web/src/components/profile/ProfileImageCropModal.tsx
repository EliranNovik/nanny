import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface ProfileImageCropModalProps {
  file: File | null;
  open: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => Promise<void> | void;
}

const FRAME_SIZE = 280;
const OUTPUT_SIZE = 512;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function ProfileImageCropModal({
  file,
  open,
  onCancel,
  onConfirm,
}: ProfileImageCropModalProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const dragStart = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const zoomPct = Math.round(((zoom - 1) / 1.5) * 100);

  useEffect(() => {
    if (!file || !open) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, open]);

  useEffect(() => {
    if (!objectUrl) return;
    const img = new Image();
    img.onload = () => {
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    img.src = objectUrl;
  }, [objectUrl]);

  const rendered = useMemo(() => {
    if (!imgSize) return null;
    const baseScale = Math.max(FRAME_SIZE / imgSize.w, FRAME_SIZE / imgSize.h);
    const scale = baseScale * zoom;
    const w = imgSize.w * scale;
    const h = imgSize.h * scale;
    const maxPanX = Math.max(0, (w - FRAME_SIZE) / 2);
    const maxPanY = Math.max(0, (h - FRAME_SIZE) / 2);
    return {
      baseScale,
      scale,
      w,
      h,
      maxPanX,
      maxPanY,
      panX: clamp(pan.x, -maxPanX, maxPanX),
      panY: clamp(pan.y, -maxPanY, maxPanY),
    };
  }, [imgSize, zoom, pan.x, pan.y]);

  useEffect(() => {
    if (!rendered) return;
    if (rendered.panX !== pan.x || rendered.panY !== pan.y) {
      setPan({ x: rendered.panX, y: rendered.panY });
    }
  }, [rendered, pan.x, pan.y]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!rendered) return;
    setDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      panX: rendered.panX,
      panY: rendered.panY,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current || !rendered) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({
      x: clamp(
        dragStart.current.panX + dx,
        -rendered.maxPanX,
        rendered.maxPanX,
      ),
      y: clamp(
        dragStart.current.panY + dy,
        -rendered.maxPanY,
        rendered.maxPanY,
      ),
    });
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    setDragging(false);
    dragStart.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  async function handleConfirm() {
    if (!file || !imgSize || !rendered) return;
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = objectUrl || "";
      });

      const scale =
        Math.max(OUTPUT_SIZE / imgSize.w, OUTPUT_SIZE / imgSize.h) * zoom;
      const drawW = imgSize.w * scale;
      const drawH = imgSize.h * scale;
      const factor = OUTPUT_SIZE / FRAME_SIZE;
      const drawX = (OUTPUT_SIZE - drawW) / 2 + rendered.panX * factor;
      const drawY = (OUTPUT_SIZE - drawH) / 2 + rendered.panY * factor;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) return;

      const cropped = new File(
        [blob],
        `${file.name.replace(/\.[^/.]+$/, "")}-cropped.jpg`,
        { type: "image/jpeg" },
      );
      await onConfirm(cropped);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onCancel() : null)}>
      <DialogContent className="w-[min(94vw,32rem)] rounded-2xl border border-border/70 bg-gradient-to-b from-white to-slate-50 p-0 shadow-2xl dark:from-zinc-900 dark:to-zinc-950">
        <div className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="text-[18px] font-semibold">
            Adjust profile photo
          </DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag to position and zoom for best framing.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
            <div className="mx-auto flex w-full justify-center">
              <div
                className="relative select-none overflow-hidden rounded-full border-2 border-white bg-muted shadow-[0_10px_35px_rgba(0,0,0,0.2)] ring-1 ring-black/5"
                style={{
                  width: FRAME_SIZE,
                  height: FRAME_SIZE,
                  cursor: dragging ? "grabbing" : "grab",
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {objectUrl && rendered && (
                  <img
                    src={objectUrl}
                    alt=""
                    draggable={false}
                    className="absolute left-1/2 top-1/2 max-w-none select-none"
                    style={{
                      width: rendered.w,
                      height: rendered.h,
                      transform: `translate(calc(-50% + ${rendered.panX}px), calc(-50% + ${rendered.panY}px))`,
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border/60 bg-background/70 px-3 py-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Zoom</span>
              <span className="font-semibold text-foreground">{zoomPct}%</span>
            </div>
            <div className="relative h-5">
              <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-border" />
              <div
                className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
                style={{ width: `${zoomPct}%` }}
              />
              <div
                className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-md ring-1 ring-primary/35"
                style={{ left: `calc(${zoomPct}% - 8px)` }}
              />
              <input
                type="range"
                min={1}
                max={2.5}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Fit</span>
              <button
                type="button"
                className="font-medium text-foreground/80 hover:text-foreground"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
              >
                Reset
              </button>
              <span>Close-up</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-w-24"
              onClick={handleConfirm}
              disabled={saving || !file}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Use photo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
