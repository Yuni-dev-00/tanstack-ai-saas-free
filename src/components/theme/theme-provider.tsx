import * as React from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  attribute?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme?: "light" | "dark";
  systemTheme?: "light" | "dark";
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  resolvedTheme: undefined,
  systemTheme: undefined,
};

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState);

// `useSyncExternalStore` expects stable (referentially equal) function
// arguments so React can skip unnecessary resubscribes. Hoisting these
// to module scope keeps the hook itself clean and silences
// unicorn/consistent-function-scoping.
const noop = () => {
  /* unsubscribe: nothing to tear down, the snapshot never changes */
};
const neverSubscribe = () => noop;
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "ui-theme",
  attribute = "class",
  enableSystem = true,
  disableTransitionOnChange = false,
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    // During SSR, always return the default theme to avoid hydration mismatch
    if (typeof window === "undefined") {
      return defaultTheme;
    }

    // Client-side: try to get theme from localStorage
    try {
      const stored = localStorage.getItem(storageKey) as Theme;
      return stored || defaultTheme;
    } catch {
      // localStorage unavailable (private mode, Safari ITP) — fall back to the default theme.
      return defaultTheme;
    }
  });

  const [systemTheme, setSystemTheme] = React.useState<"light" | "dark" | undefined>(() => {
    // During SSR, return undefined
    if (typeof window === "undefined") {
      return undefined;
    }

    // Client-side: detect system theme
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  // Hydration flag via useSyncExternalStore avoids the setState-in-effect
  // pattern (react-hooks/set-state-in-effect). Server snapshot returns
  // false; client snapshot returns true immediately after hydration.
  const isMounted = React.useSyncExternalStore(
    neverSubscribe,
    clientSnapshot,
    serverSnapshot,
  );

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  const setTheme = React.useCallback(
    (newTheme: Theme) => {
      try {
        localStorage.setItem(storageKey, newTheme);
      } catch {
        // localStorage.setItem blocked (private mode, quota exceeded) — theme still applied in memory.
      }
      setThemeState(newTheme);
    },
    [storageKey]
  );

  const applyTheme = React.useCallback(
    (targetTheme: "light" | "dark" | undefined) => {
      if (!targetTheme || typeof document === "undefined") return;

      const root = document.documentElement;

      if (disableTransitionOnChange) {
        const css = document.createElement("style");
        css.appendChild(
          document.createTextNode(
            `*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}`
          )
        );
        document.head.appendChild(css);

        // Force reflow
        (() => window.getComputedStyle(document.body))();

        setTimeout(() => {
          css.remove();
        }, 1);
      }

      if (attribute === "class") {
        root.classList.remove("light", "dark");
        root.classList.add(targetTheme);
      } else {
        root.setAttribute(attribute, targetTheme);
      }
    },
    [attribute, disableTransitionOnChange]
  );

  // Apply theme on mount and when resolvedTheme changes
  React.useEffect(() => {
    if (isMounted) {
      applyTheme(resolvedTheme);
    }
  }, [resolvedTheme, applyTheme, isMounted]);

  // Handle system theme changes
  React.useEffect(() => {
    if (!enableSystem || typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [enableSystem]);

  // Prevent flash during SSR by applying theme via script
  React.useEffect(() => {
    if (typeof document === "undefined") return;

    // Create a script that runs before React hydration to prevent FOIT.
    // Use `.text` (assigning to the script's text content) instead of
    // innerHTML — the content is JS, not HTML, and .text avoids the
    // HTML parser entirely. Safer if anyone later interpolates a value.
    const script = document.createElement("script");
    script.text = `
      try {
        var theme = localStorage.getItem('${storageKey}') || '${defaultTheme}';
        var systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        var resolvedTheme = theme === 'system' ? systemTheme : theme;
        
        if (resolvedTheme === 'dark') {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.add('light');
          document.documentElement.classList.remove('dark');
        }
      } catch {
        /* localStorage may be blocked (private mode, 3rd-party cookie
           policy); fall through to the default theme. */
      }
    `;

    // Only add if not already present
    if (!document.querySelector(`script[data-theme-script]`)) {
      script.dataset.themeScript = 'true';
      document.head.appendChild(script);
    }
  }, [storageKey, defaultTheme]);

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme: isMounted ? resolvedTheme : undefined,
      systemTheme: isMounted ? systemTheme : undefined,
    }),
    [theme, setTheme, resolvedTheme, systemTheme, isMounted]
  );

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};