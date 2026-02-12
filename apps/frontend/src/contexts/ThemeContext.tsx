import React, { createContext, useContext, useEffect, useMemo } from 'react';

/**
 * Karmyq Theme System
 *
 * CSS-variable-backed theming that allows per-community skins.
 * Default values live in globals.css (:root).
 * Overrides are applied by writing CSS custom properties to document.documentElement.
 *
 * To add a community skin, pass a partial CommunityTheme to ThemeProvider.
 * Only the supplied tokens are overridden; everything else falls through to :root.
 */

/** RGB triplet string, e.g. "45 110 40" */
type RGBTriplet = string;

export interface CommunityTheme {
  primary?: RGBTriplet;
  primaryLight?: RGBTriplet;
  primaryMedium?: RGBTriplet;
  primaryDark?: RGBTriplet;
  accent?: RGBTriplet;
  accentLight?: RGBTriplet;
  accentDark?: RGBTriplet;
  surface?: RGBTriplet;
  surfaceRaised?: RGBTriplet;
  text?: RGBTriplet;
  textMuted?: RGBTriplet;
  textSubtle?: RGBTriplet;
  border?: RGBTriplet;
  borderLight?: RGBTriplet;
}

/** Maps CommunityTheme keys → CSS variable names */
const TOKEN_TO_VAR: Record<keyof CommunityTheme, string> = {
  primary: '--color-primary',
  primaryLight: '--color-primary-light',
  primaryMedium: '--color-primary-medium',
  primaryDark: '--color-primary-dark',
  accent: '--color-accent',
  accentLight: '--color-accent-light',
  accentDark: '--color-accent-dark',
  surface: '--color-surface',
  surfaceRaised: '--color-surface-raised',
  text: '--color-text',
  textMuted: '--color-text-muted',
  textSubtle: '--color-text-subtle',
  border: '--color-border',
  borderLight: '--color-border-light',
};

interface ThemeContextValue {
  /** Current community theme overrides (empty = default karmyq palette) */
  communityTheme: CommunityTheme | null;
}

const ThemeContext = createContext<ThemeContextValue>({ communityTheme: null });

export function useTheme() {
  return useContext(ThemeContext);
}

interface ThemeProviderProps {
  children: React.ReactNode;
  communityTheme?: CommunityTheme | null;
}

export function ThemeProvider({ children, communityTheme = null }: ThemeProviderProps) {
  // Apply / remove overrides whenever the community theme changes
  useEffect(() => {
    const root = document.documentElement;

    if (!communityTheme) {
      // Clear all overrides — falls back to :root defaults in globals.css
      Object.values(TOKEN_TO_VAR).forEach((varName) => {
        root.style.removeProperty(varName);
      });
      return;
    }

    // Apply only the tokens that are set
    (Object.entries(communityTheme) as [keyof CommunityTheme, string | undefined][]).forEach(
      ([key, value]) => {
        const varName = TOKEN_TO_VAR[key];
        if (varName && value) {
          root.style.setProperty(varName, value);
        }
      }
    );

    // Cleanup: remove overrides when community changes
    return () => {
      Object.values(TOKEN_TO_VAR).forEach((varName) => {
        root.style.removeProperty(varName);
      });
    };
  }, [communityTheme]);

  const value = useMemo(() => ({ communityTheme }), [communityTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
