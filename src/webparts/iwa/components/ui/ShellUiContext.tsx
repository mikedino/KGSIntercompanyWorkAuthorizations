import { AlertColor } from "@mui/material";
import * as React from "react";

export interface IShellUiContextValue {
    showAlert: (title: string, message: string) => boolean;
    hideAlert: () => boolean;
    showBusy: (message: string) => boolean;
    hideBusy: () => boolean;
    showSuccess: (message: string) => boolean;
    showBackdropSuccess: (message: string) => boolean;
    hideSuccess: () => boolean;
    showSnackbar: (message: string, severity?: AlertColor, durationMs?: number) => boolean;
    hideSnackbar: () => boolean;
    alertOpen: boolean;
    alertTitle: string;
    alertMessage: string;
    busyOpen: boolean;
    busyMessage: string;
    successOpen: boolean;
    successMessage: string;
    snackbarOpen: boolean;
    snackbarMessage: string;
    snackbarSeverity: AlertColor;
    snackbarDurationMs?: number;
}

const ShellUiContext = React.createContext<IShellUiContextValue | undefined>(undefined);

export const useShellUi = (): IShellUiContextValue => {
    const value = React.useContext(ShellUiContext);

    if (!value) {
        throw new Error("useShellUi must be used inside ShellUiProvider.");
    }

    return value;
};

interface IShellUiProviderProps {
    children: React.ReactNode;
}

export const ShellUiProvider: React.FC<IShellUiProviderProps> = ({ children }): JSX.Element => {

    const [alertOpen, setAlertOpen] = React.useState<boolean>(false);
    const [alertTitle, setAlertTitle] = React.useState<string>("");
    const [alertMessage, setAlertMessage] = React.useState<string>("");

    const [busyOpen, setBusyOpen] = React.useState<boolean>(false);
    const [busyMessage, setBusyMessage] = React.useState<string>("");

    const [successOpen, setSuccessOpen] = React.useState<boolean>(false);
    const [successMessage, setSuccessMessage] = React.useState<string>("");
    const [snackbarOpen, setSnackbarOpen] = React.useState<boolean>(false);
    const [snackbarMessage, setSnackbarMessage] = React.useState<string>("");
    const [snackbarSeverity, setSnackbarSeverity] = React.useState<AlertColor>("success");
    const [snackbarDurationMs, setSnackbarDurationMs] = React.useState<number | undefined>(3000);

    const showAlert = React.useCallback((title: string, message: string): boolean => {
        setAlertTitle(title);
        setAlertMessage(message);
        setAlertOpen(true);
        return true;
    }, []);

    const hideAlert = React.useCallback((): boolean => {
        setAlertOpen(false);
        return true;
    }, []);

    const showBusy = React.useCallback((message: string): boolean => {
        setSuccessOpen(false);
        setSuccessMessage("");
        setSnackbarOpen(false);
        setSnackbarMessage("");
        setBusyMessage(message);
        setBusyOpen(true);
        return true;
    }, []);

    const hideBusy = React.useCallback((): boolean => {
        setBusyOpen(false);
        setBusyMessage("");
        return true;
    }, []);

    const showSnackbar = React.useCallback((message: string, severity: AlertColor = "success", durationMs?: number): boolean => {
        setBusyOpen(false);
        setBusyMessage("");
        setSuccessOpen(false);
        setSuccessMessage("");
        setSnackbarSeverity(severity);
        setSnackbarMessage(message);
        setSnackbarDurationMs(durationMs ?? (severity === "warning" || severity === "error" ? undefined : 3000));
        setSnackbarOpen(true);
        return true;
    }, []);

    const hideSnackbar = React.useCallback((): boolean => {
        setSnackbarOpen(false);
        setSnackbarMessage("");
        setSnackbarDurationMs(3000);
        return true;
    }, []);

    const showSuccess = React.useCallback((message: string): boolean => {
        return showSnackbar(message, "success");
    }, [showSnackbar]);

    const showBackdropSuccess = React.useCallback((message: string): boolean => {
        setBusyOpen(false);
        setBusyMessage("");
        setSnackbarOpen(false);
        setSnackbarMessage("");
        setSuccessMessage(message);
        setSuccessOpen(true);
        return true;
    }, []);

    const hideSuccess = React.useCallback((): boolean => {
        setSuccessOpen(false);
        setSuccessMessage("");
        hideSnackbar();
        return true;
    }, [hideSnackbar]);

    const value = React.useMemo<IShellUiContextValue>(() => {
        return {
            showAlert,
            hideAlert,
            showBusy,
            hideBusy,
            showSuccess,
            showBackdropSuccess,
            hideSuccess,
            showSnackbar,
            hideSnackbar,
            alertOpen,
            alertTitle,
            alertMessage,
            busyOpen,
            busyMessage,
            successOpen,
            successMessage,
            snackbarOpen,
            snackbarMessage,
            snackbarSeverity,
            snackbarDurationMs
        };
    }, [
        showAlert,
        hideAlert,
        showBusy,
        hideBusy,
        showSuccess,
        showBackdropSuccess,
        hideSuccess,
        showSnackbar,
        hideSnackbar,
        alertOpen,
        alertTitle,
        alertMessage,
        busyOpen,
        busyMessage,
        successOpen,
        successMessage,
        snackbarOpen,
        snackbarMessage,
        snackbarSeverity,
        snackbarDurationMs
    ]);

    return (
        <ShellUiContext.Provider value={value}>
            {children}
        </ShellUiContext.Provider>
    );
};
