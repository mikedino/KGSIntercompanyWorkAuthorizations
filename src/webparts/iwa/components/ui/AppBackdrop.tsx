import * as React from "react";
import {
    Backdrop,
    CircularProgress,
    Fab,
    Stack,
    Typography
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { useShellUi } from "./ShellUiContext";

export const AppBackdropHost: React.FC = (): JSX.Element => {

    const {
        busyOpen,
        busyMessage,
        successOpen,
        successMessage,
        hideSuccess
    } = useShellUi();

    const handleCloseSuccess = React.useCallback(async (): Promise<boolean> => {
        await Promise.resolve(hideSuccess());
        return true;
    }, [hideSuccess]);

    return (
        <Backdrop
            sx={(theme) => ({
                zIndex: theme.zIndex.drawer + 20,
                color: "#fff",
                backgroundColor: "rgba(0, 0, 0, 0.72)"
            })}
            open={busyOpen || successOpen}
            onClick={successOpen ? handleCloseSuccess : undefined}
        >
            {busyOpen && (
                <Stack spacing={2} alignItems="center">
                    <CircularProgress size={64} sx={{ color: "warning.main" }} />
                    <Typography variant="h6" fontWeight={500}>
                        {busyMessage}
                    </Typography>
                </Stack>
            )}

            {successOpen && (
                <Stack spacing={2} alignItems="center">
                    <Fab color="success" onClick={handleCloseSuccess}>
                        <CheckIcon />
                    </Fab>
                    <Typography variant="h6" fontWeight={500}>
                        {successMessage}
                    </Typography>
                </Stack>
            )}
        </Backdrop>
    );
};