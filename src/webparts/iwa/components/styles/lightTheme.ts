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
    action: {
      active: '#0288d1',
    },
    background: {
      default: '#fafafa',
    },
    text: {
      primary: '#0a2240',
      secondary: "#005C6C"
    }
  }
});