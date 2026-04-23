// EXTEND THEME TO ADD CUSTOM PROPERTIES FOR RESUABLE CARDS

import "@mui/material/styles";
import { PaletteColor, SimplePaletteColorOptions } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    accent: PaletteColor;
  }

  interface PaletteOptions {
    accent?: SimplePaletteColorOptions;
  }

  interface Theme {
    custom?: {
      cardBg: string;
      cardBorder: string;
    };
  }
  interface ThemeOptions {
    custom?: {
      cardBg?: string;
      cardBorder?: string;
    };
  }
}
