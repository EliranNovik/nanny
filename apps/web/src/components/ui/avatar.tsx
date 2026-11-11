import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";
import { avatarUrl } from "@/lib/imageTransform";

const INITIAL_GRADIENTS = [
  ["#fb7185", "#f97316"],
  ["#f59e0b", "#ef4444"],
  ["#f97316", "#ec4899"],
  ["#34d399", "#0891b2"],
  ["#22d3ee", "#6366f1"],
  ["#818cf8", "#c026d3"],
  ["#e879f9", "#fb7185"],
  ["#2dd4bf", "#3b82f6"],
  ["#a3e635", "#0d9488"],
  ["#60a5fa", "#7c3aed"],
] as const;

function initialsText(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(initialsText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
    return initialsText(children.props.children);
  }
  return "";
}

export function initialsGradient(seed: string) {
  let hash = 0;
  const value = seed.trim().toLowerCase() || "?";
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  const [from, to] = INITIAL_GRADIENTS[hash % INITIAL_GRADIENTS.length];
  const angle = 125 + (hash % 50);
  return `linear-gradient(${angle}deg, ${from}, ${to})`;
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className,
    )}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, src, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    src={avatarUrl.xs(src)}
    decoding="async"
    className={cn(
      "h-full w-full object-cover object-[center_18%]",
      className,
    )}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, children, style, ...props }, ref) => {
  const seed = initialsText(children).trim();
  const keepPlain =
    !seed ||
    /(?:^|\s)(?:text-white|bg-white\/|bg-black(?:\/|\s|$))/.test(className ?? "");
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      style={
        keepPlain
          ? style
          : { ...style, backgroundImage: initialsGradient(seed), color: "#fff" }
      }
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full font-semibold",
        keepPlain && "bg-muted font-medium",
        className,
      )}
      {...props}
    >
      {children}
    </AvatarPrimitive.Fallback>
  );
});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
