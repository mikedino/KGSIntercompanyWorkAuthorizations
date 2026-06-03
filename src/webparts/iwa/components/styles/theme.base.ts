import { ThemeOptions } from "@mui/material/styles";

export const fontSizeDefault = 12;
export const minInputHeight = 38;
const lineHeight = "21px";

export const baseTheme: ThemeOptions = {
    typography: {
        fontSize: fontSizeDefault, // global baseline
        fontFamily: ["Segoe UI", "Arial", "sans-serif"].join(","),
    },

    components: {
        // Smooth transitions globally
        MuiCssBaseline: {
            styleOverrides: {
                html: {
                    minHeight: "100%",
                    backgroundColor: "var(--iwa-app-bg)",
                },
                body: {
                    minHeight: "100%",
                    backgroundColor: "var(--iwa-app-bg)",
                    transition: "background-color 300ms ease, color 300ms ease",
                },
                "#spPageCanvasContent, #workbenchPageContent, .CanvasComponent, .CanvasZone, .ControlZone, .SPCanvas, .ms-Fabric": {
                    backgroundColor: "var(--iwa-app-bg)",
                },
            },
        },
        MuiInputBase: {
            styleOverrides: {
                root: {
                    fontSize: fontSizeDefault,
                    lineHeight: lineHeight,
                },
            },
        },
        MuiList: {
            styleOverrides: {
                root: {
                    fontSize: fontSizeDefault,
                },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    fontSize: fontSizeDefault,
                    padding: "2px 16px"
                },
            },
        },
        MuiMenu: {
            styleOverrides: {
                root: {
                    fontSize: fontSizeDefault,
                },
            }
        },
        MuiMenuList: {
            styleOverrides: {
                root: {
                    fontSize: fontSizeDefault,
                },
            },
        },
        MuiTextField: {
            defaultProps: {
                size: "small",
                variant: "outlined",
            },
            styleOverrides: {
                root: {
                    fontSize: fontSizeDefault
                }
            }
        },
        MuiFormHelperText: {
            styleOverrides: {
                root: {
                    fontSize: "0.75rem"
                }
            }
        },
        MuiSelect: {
            defaultProps: { size: "small" },
        },
        MuiFormControl: {
            defaultProps: { size: "small" },
        },
        MuiAutocomplete: {
            defaultProps: {
                size: "small",
            },
            styleOverrides: {
                option: {
                    fontSize: fontSizeDefault,
                },
                input: {
                    fontSize: fontSizeDefault,
                },
                paper: {
                    fontSize: fontSizeDefault,
                },
                inputRoot: ({ theme }) => ({
                    minHeight: minInputHeight,
                    alignItems: "center",

                    "&&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: theme.palette.info.main,
                        borderWidth: 2,
                    },
                }),
            },
        },
        //outlined inputs on forms
        MuiOutlinedInput: {
            styleOverrides: {
                root: ({ theme }) => ({
                    minHeight: minInputHeight,
                    alignItems: "center",
                    fontSize: fontSizeDefault,

                    "&.MuiInputBase-sizeSmall": {
                        minHeight: minInputHeight
                    },

                    "& .MuiOutlinedInput-notchedOutline": {
                        border: `1px solid ${theme.palette.secondary.light}`,
                    },

                    "&:hover .MuiOutlinedInput-notchedOutline": {
                        border: `1px solid ${theme.palette.action.hover}`,
                    },

                    "&&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: theme.palette.info.main,
                        borderWidth: 2,
                    }
                }),
                input: {
                    paddingTop: "8.5px",
                    paddingBottom: "8.5px",
                    lineHeight: lineHeight,
                    boxSizing: "border-box",

                    "&.MuiInputBase-inputSizeSmall": {
                        paddingTop: "8px",
                        paddingBottom: "8px"
                    }
                }
            }
        },

        //focused label color
        MuiInputLabel: {
            styleOverrides: {
                root: ({ theme }) => ({
                    fontSize: fontSizeDefault,
                    "&.Mui-focused": {
                        color: theme.palette.info.main
                    },
                    // only the resting label (before input/focus)
                    "&:not(.MuiInputLabel-shrink)": {
                        transform: "translate(14px, 12px) scale(1)",
                    }
                }),
            },
        },
        MuiInput: {
            styleOverrides: {
                underline: ({ theme }) => ({
                    "&:after": {
                        bottomBorder: `1px solid ${theme.palette.info.main}`
                    },
                }),
            },
        },
        MuiFilledInput: {
            styleOverrides: {
                root: ({ theme }) => ({
                    "&.Mui-focused": {
                        backgroundColor: "transparent",
                    },
                    "&:after": {
                        bottomBorder: `1px solid ${theme.palette.info.main}`
                    },
                }),
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: ({ theme }) => ({
                    borderRadius: 8,
                    backgroundImage: "none",
                    transition: "background-color 250ms ease",
                    border: `1px solid ${theme.palette.divider}`
                }),
            },
        },
        MuiCard: {
            styleOverrides: {
                root: ({ theme }) => ({
                    borderRadius: 8,
                    border: `1px solid ${theme.palette.divider}`
                }),
            },
        }
    }
};
