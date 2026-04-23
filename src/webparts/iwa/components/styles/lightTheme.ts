import { createTheme } from "@mui/material/styles";
import { baseTheme } from "./theme.base";

export const lightTheme = createTheme({
  ...baseTheme,
  palette: {
    mode: 'light',
    primary: {
      main: '#0a314d',
    },
    secondary: {
      main: '#0078D4',
    },
    error: {
      main: '#d01319',
    },
    warning: {
      main: '#F7C25B',
    },
    info: {
      main: '#005C6C',
    },
    success: {
      main: '#28A70C',
    },
    accent: {
      main: '#ff6900',
      light: '#ff8a33',
      dark: '#b84d00',
      contrastText: '#ffffff'
    },
    action: {
      active: '#00B7FF',
    },
    background: {
      default: '#fafafa',
    },
    text: {
      primary: '#323130',
      secondary: "#005C6C"
    }
  }
});