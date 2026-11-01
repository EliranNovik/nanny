import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";
export type ThemePreference = "light" | "dark" | "auto";

const THEME_PREFERENCE_STORAGE_KEY = "themePreference";
const LEGACY_THEME_STORAGE_KEY = "theme";

interface ThemeContextType {
  /** Resolved theme applied to the document. */
  theme: Theme;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
  /** Sets an explicit light/dark preference (not auto). */
  setTheme: (theme: Theme) => void;
  /** Light-only screens (e.g. landing) register here; the stored preference is untouched. */
  acquireForcedLight: () => () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "auto";

  const stored = localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "auto") {
    return stored;
  }

  const legacy = localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
  if (legacy === "light" || legacy === "dark") return legacy;

  return "auto";
}

function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): Theme {
  if (preference === "auto") return systemPrefersDark ? "dark" : "light";
  return preference;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>(readStoredThemePreference);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const [forcedLightCount, setForcedLightCount] = useState(0);
  const theme: Theme =
    forcedLightCount > 0 ? "light" : resolveTheme(themePreference, systemPrefersDark);

  const acquireForcedLight = useCallback(() => {
    setForcedLightCount((n) => n + 1);
    return () => setForcedLightCount((n) => Math.max(0, n - 1));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemPrefersDark(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.style.colorScheme = forcedLightCount > 0 ? "light" : "";
  }, [theme, forcedLightCount]);

  const persistThemePreference = (preference: ThemePreference) => {
    setThemePreferenceState(preference);
    localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
    localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
  };

  const setThemePreference = (preference: ThemePreference) => {
    persistThemePreference(preference);
  };

  const setTheme = (newTheme: Theme) => {
    persistThemePreference(newTheme);
  };

  const toggleTheme = () => {
    persistThemePreference(theme === "light" ? "dark" : "light");
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themePreference,
        setThemePreference,
        toggleTheme,
        setTheme,
        acquireForcedLight,
      }}
    >
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

/** Forces light theme while the calling component is mounted. */
export function useForceLightTheme() {
  const { acquireForcedLight } = useTheme();
  useEffect(() => acquireForcedLight(), [acquireForcedLight]);
}
