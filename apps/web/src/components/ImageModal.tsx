import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Download, Share2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImageMessage {
  id: string;
  attachment_url: string;
  attachment_name: string | null;
  sender_id: string;
  created_at: string;
}

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentImage: ImageMessage;
  allImages: ImageMessage[];
  onImageSelect: (image: ImageMessage) => void;
}

export function ImageModal({
  isOpen,
  onClose,
  currentImage,
  allImages,
  onImageSelect,
}: ImageModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentImage && allImages.length > 0) {
      const index = allImages.findIndex((img) => img.id === currentImage.id);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [currentImage, allImages]);

  const currentImg = allImages[currentIndex] || currentImage;

  function handlePrevious() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      onImageSelect(allImages[currentIndex - 1]);
    }
  }

  function handleNext() {
    if (currentIndex < allImages.length - 1) {
      setCurrentIndex(currentIndex + 1);
      onImageSelect(allImages[currentIndex + 1]);
    }
  }

  async function handleDownload() {
    if (!currentImg?.attachment_url) return;

    try {
      const response = await fetch(currentImg.attachment_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = currentImg.attachment_name || "image.jpg";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading image:", error);
      alert("Failed to download image");
    }
  }

  async function handleShare() {
    if (!currentImg?.attachment_url) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: currentImg.attachment_name || "Image",
          url: currentImg.attachment_url,
        });
      } catch (error) {
        // User cancelled or error occurred
        if ((error as Error).name !== "AbortError") {
          console.error("Error sharing:", error);
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(currentImg.attachment_url);
        alert("Image URL copied to clipboard!");
      } catch (error) {
        console.error("Error copying to clipboard:", error);
        alert("Failed to share image");
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] h-[95vh] p-0 flex flex-col bg-black/95 overflow-hidden">
        <VisuallyHidden.Root>
          <DialogTitle>Image Viewer</DialogTitle>
          <DialogDescription>
            Viewing image {currentIndex + 1} of {allImages.length}: {currentImg.attachment_name || "Image"}
          </DialogDescription>
        </VisuallyHidden.Root>
        {/* Top Bar - Download and Share */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              className="text-white hover:bg-white/10"
            >
              <Download className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="text-white hover:bg-white/10"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Main Image Area */}
        <div className="flex-1 flex items-center justify-center relative min-h-0 p-4 overflow-hidden">
          {/* Navigation Arrows */}
          {allImages.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className={cn(
                  "absolute left-4 z-10 text-white hover:bg-white/10",
                  currentIndex === 0 && "opacity-50 cursor-not-allowed"
                )}
              >
                <ChevronLeft className="w-8 h-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                disabled={currentIndex === allImages.length - 1}
                className={cn(
                  "absolute right-4 z-10 text-white hover:bg-white/10",
                  currentIndex === allImages.length - 1 && "opacity-50 cursor-not-allowed"
                )}
              >
                <ChevronRight className="w-8 h-8" />
              </Button>
            </>
          )}

          {/* Centered Image */}
          <div className="flex items-center justify-center w-full h-full">
            <img
              src={currentImg.attachment_url}
              alt={currentImg.attachment_name || "Image"}
              className="max-w-full max-h-full object-contain rounded-lg"
              style={{ maxHeight: 'calc(95vh - 200px)' }}
            />
          </div>
        </div>

        {/* Bottom Panel - All Images */}
        {allImages.length > 1 && (
          <div className="border-t border-white/10 p-4 flex-shrink-0">
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-2">
                {allImages.map((img, index) => (
                  <button
                    key={img.id}
                    onClick={() => {
                      setCurrentIndex(index);
                      onImageSelect(img);
                    }}
                    className={cn(
                      "flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden border-2 transition-all",
                      index === currentIndex
                        ? "border-primary ring-2 ring-primary/50"
                        : "border-transparent opacity-60 hover:opacity-100 hover:border-white/30"
                    )}
                  >
                    <img
                      src={img.attachment_url}
                      alt={img.attachment_name || `Image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

