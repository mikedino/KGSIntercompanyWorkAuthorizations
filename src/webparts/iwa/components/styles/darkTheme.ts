import { createTheme } from "@mui/material/styles";
import { baseTheme } from "./theme.base";

export const darkTheme = createTheme({
  ...baseTheme,
  palette: {
    mode: "dark",
    primary: {
      main: "#00B7FF",
    },
    secondary: {
      main: "#f9b818",
      light: "rgba(255,255,255,0.23)"
    },
    error: {
      main: "#FF4433",
    },
    warning: {
      main: "#F4B740",
    },
    info: {
      //main: "#0078D4",
      main: "#ec66ff"
    },
    success: {
      main: "#2ec20e",
    },
    accent: {
      main: "#ff6900",
      light: "#ff9b4d",
      dark: "#ff6900",
      contrastText: "#fff5ee"
    },
    background: {
      default: "#031222",
      paper: "#091e31",
    },
    text: {
      primary: "#f9f9f9",
      secondary: "#8bbcdc",
      disabled: "#ffffff85",
    },
    divider: "rgba(219, 220, 255, 0.3)",
    action: {
      active: "#00B7FF",
      hover: "rgba(255,255,255,0.08)",
      selected: "rgba(255,255,255,0.14)",
      disabled: "rgba(255,255,255,0.3)",
      disabledBackground: "rgba(255,255,255,0.12)",
    },
  },
});