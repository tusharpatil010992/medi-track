"use client";

import { createTheme } from "@mui/material/styles";

/**
 * Single MUI theme carrying both colour schemes.
 *
 * `cssVariables` + `colorSchemes` lets MUI resolve light/dark from a CSS media
 * query at paint time. That avoids the hydration mismatch and first-paint flash
 * you get from deciding the mode in React with useMediaQuery.
 */
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "media" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#1976d2", dark: "#1565c0", light: "#42a5f5" },
        secondary: { main: "#dc004e" },
        success: { main: "#2e7d32" },
        warning: { main: "#f57c00" },
        error: { main: "#d32f2f" },
        info: { main: "#0288d1" },
        background: { default: "#fafafa", paper: "#ffffff" },
        text: { primary: "#000000", secondary: "#666666" },
        divider: "#e0e0e0",
      },
    },
    dark: {
      palette: {
        primary: { main: "#90caf9", dark: "#42a5f5", light: "#bbdefb" },
        secondary: { main: "#f48fb1" },
        success: { main: "#66bb6a" },
        warning: { main: "#ffa726" },
        error: { main: "#f44336" },
        info: { main: "#29b6f6" },
        background: { default: "#121212", paper: "#1e1e1e" },
        text: { primary: "#ffffff", secondary: "#b0b0b0" },
        divider: "#424242",
      },
    },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: "32px", fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: "28px", fontWeight: 700, lineHeight: 1.3 },
    h3: { fontSize: "24px", fontWeight: 600, lineHeight: 1.4 },
    h4: { fontSize: "20px", fontWeight: 600, lineHeight: 1.4 },
    h5: { fontSize: "16px", fontWeight: 600, lineHeight: 1.5 },
    h6: { fontSize: "14px", fontWeight: 600, lineHeight: 1.5 },
    body1: { fontSize: "16px", fontWeight: 400, lineHeight: 1.6 },
    body2: { fontSize: "14px", fontWeight: 400, lineHeight: 1.6 },
    caption: { fontSize: "12px", fontWeight: 400, lineHeight: 1.5 },
    overline: { fontSize: "11px", fontWeight: 600, lineHeight: 1.6, textTransform: "uppercase" },
  },
});
