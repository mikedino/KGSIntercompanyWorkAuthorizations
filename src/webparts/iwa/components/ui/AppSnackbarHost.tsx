import * as React from "react";
import { Alert, Snackbar } from "@mui/material";
import { useShellUi } from "./ShellUiContext";

export const AppSnackbarHost: React.FC = (): JSX.Element => {
    const {
        snackbarOpen,
        snackbarMessage,
        snackbarSeverity,
        hideSnackbar
    } = useShellUi();

    const handleClose = React.useCallback((
        _event?: React.SyntheticEvent | Event,
        reason?: string
    ): void => {
        if (reason === "clickaway") {
            return;
        }

        hideSnackbar();
    }, [hideSnackbar]);

    return (
        <Snackbar
            open={snackbarOpen}
            autoHideDuration={snackbarSeverity === "warning" || snackbarSeverity === "error" ? null : 3000}
            onClose={handleClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            sx={{
                mt: 2,
                maxWidth: { xs: "calc(100vw - 32px)", sm: 720 }
            }}
        >
            <Alert
                onClose={() => hideSnackbar()}
                severity={snackbarSeverity}
                variant={snackbarSeverity === "warning" ? "outlined" : "filled"}
                sx={(theme) => ({
                    width: "100%",
                    boxShadow: theme.shadows[8],
                    ...(snackbarSeverity === "warning"
                        ? {
                            bgcolor: theme.palette.warning.light,
                            borderColor: theme.palette.warning.dark,
                            color: theme.palette.warning.contrastText,
                            "& .MuiAlert-icon": {
                                color: theme.palette.warning.dark
                            }
                        }
                        : {})
                })}
            >
                {snackbarMessage}
            </Alert>
        </Snackbar>
    );
};
