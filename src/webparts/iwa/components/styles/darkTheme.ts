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
      main: "#0078D4",
    },
    success: {
      main: "#28A70C",
    },
    background: {
      default: "#031222",
      paper: "#091e31",
    },
    text: {
      primary: "#f9f9f9",
      secondary: "rgba(255,255,255,0.65)",
      disabled: "#ffffff85",
    },
    divider: "rgba(200, 220, 255, 0.18)",
    action: {
      active: "#00B7FF",
      //active: "rgba(255,255,255,0.72)",
      hover: "rgba(255,255,255,0.08)",
      selected: "rgba(255,255,255,0.14)",
      disabled: "rgba(255,255,255,0.3)",
      disabledBackground: "rgba(255,255,255,0.12)",
    },
  },
});