import * as React from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

interface ConfirmDeleteDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    error?: string;
    busy?: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
    open,
    title,
    message,
    confirmLabel = "Delete",
    error = "",
    busy = false,
    onClose,
    onConfirm
}) => {
    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
            <DialogTitle>{title}</DialogTitle>

            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Typography>{message}</Typography>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={busy}>
                    Cancel
                </Button>
                <Button
                    color="error"
                    variant="contained"
                    onClick={() => {
                        onConfirm().catch((err) => console.error("Delete confirm failed", err));
                    }}
                    disabled={busy}
                >
                    {confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
};