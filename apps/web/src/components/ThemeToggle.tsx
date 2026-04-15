import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={toggleTheme}
      className={cn(
        "group inline-flex h-9 w-[4.25rem] items-center rounded-full border border-border/70 bg-zinc-100 px-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-zinc-800",
        isDark ? "justify-end bg-zinc-800 dark:bg-zinc-700" : "justify-start",
        className,
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Dark mode" : "Light mode"}
    >
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full bg-card shadow-md transition-transform duration-200 dark:bg-background",
          isDark ? "text-amber-400" : "text-slate-500",
        )}
      >
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </span>
    </button>
  );
}
