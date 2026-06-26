import * as React from "react";
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from "@mui/material";

export interface IAlertDialogProps {
    open: boolean;
    title: string;
    message: string;
    onClose: () => void;

    /** Optional overrides */
    closeText?: string;
    maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
    fullWidth?: boolean;
}

const AlertDialog: React.FC<IAlertDialogProps> = ({
    open,
    title,
    message,
    onClose,
    closeText = "Close",
    maxWidth = "sm",
    fullWidth = true
}) => {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
            maxWidth={maxWidth}
            fullWidth={fullWidth}
        >
            <DialogTitle id="alert-dialog-title">
                {title}
            </DialogTitle>

            <DialogContent>
                <DialogContentText id="alert-dialog-description">
                    {message}
                </DialogContentText>
            </DialogContent>

            <DialogActions>
                <Button
                    onClick={onClose}
                    variant="contained"
                    color="primary"
                    aria-label={closeText}
                    title={closeText}
                >
                    {closeText}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AlertDialog;
