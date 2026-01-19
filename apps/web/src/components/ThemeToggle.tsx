import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ThemeToggle({ 
  className, 
  variant = "outline",
  size = "default"
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleTheme}
      className={cn("gap-2", className)}
      aria-label="Toggle theme"
    >
      {theme === "light" ? (
        <>
          <Moon className="w-4 h-4" />
          <span className="hidden sm:inline">Dark Mode</span>
        </>
      ) : (
        <>
          <Sun className="w-4 h-4" />
          <span className="hidden sm:inline">Light Mode</span>
        </>
      )}
    </Button>
  );
}
