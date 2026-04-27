import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const getAutoThemeByTime = (): Theme => {
    const hour = new Date().getHours();
    // Daytime is 6 AM to 6 PM (18:00)
    return hour >= 6 && hour < 18 ? "light" : "dark";
  };

  const [theme, setThemeState] = useState<Theme>(() => {
    // We now prioritize the automatic time-based theme globally on startup
    return getAutoThemeByTime();
  });

  // Automatically update theme when time passes significant thresholds
  useEffect(() => {
    const checkTheme = () => {
      // Always sync with the clock to fulfill the "automatic" requirement
      setThemeState(getAutoThemeByTime());
    };

    const interval = setInterval(checkTheme, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Update the DOM class whenever the theme state changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setThemeState(next);
    // Persist as a hard manual preference
    localStorage.setItem("theme", next);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    // Persist as a hard manual preference
    localStorage.setItem("theme", newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
