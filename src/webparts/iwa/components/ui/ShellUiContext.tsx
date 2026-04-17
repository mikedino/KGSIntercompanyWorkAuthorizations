import * as React from "react";

export interface IShellUiContextValue {
    showAlert: (title: string, message: string) => boolean;
    hideAlert: () => boolean;
    showBusy: (message: string) => boolean;
    hideBusy: () => boolean;
    showSuccess: (message: string) => boolean;
    hideSuccess: () => boolean;
    alertOpen: boolean;
    alertTitle: string;
    alertMessage: string;
    busyOpen: boolean;
    busyMessage: string;
    successOpen: boolean;
    successMessage: string;
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
        setBusyMessage(message);
        setBusyOpen(true);
        return true;
    }, []);

    const hideBusy = React.useCallback((): boolean => {
        setBusyOpen(false);
        setBusyMessage("");
        return true;
    }, []);

    const showSuccess = React.useCallback((message: string): boolean => {
        setBusyOpen(false);
        setBusyMessage("");
        setSuccessMessage(message);
        setSuccessOpen(true);
        return true;
    }, []);

    const hideSuccess = React.useCallback((): boolean => {
        setSuccessOpen(false);
        setSuccessMessage("");
        return true;
    }, []);

    const value = React.useMemo<IShellUiContextValue>(() => {
        return {
            showAlert,
            hideAlert,
            showBusy,
            hideBusy,
            showSuccess,
            hideSuccess,
            alertOpen,
            alertTitle,
            alertMessage,
            busyOpen,
            busyMessage,
            successOpen,
            successMessage
        };
    }, [
        showAlert,
        hideAlert,
        showBusy,
        hideBusy,
        showSuccess,
        hideSuccess,
        alertOpen,
        alertTitle,
        alertMessage,
        busyOpen,
        busyMessage,
        successOpen,
        successMessage
    ]);

    return (
        <ShellUiContext.Provider value={value}>
            {children}
        </ShellUiContext.Provider>
    );
};