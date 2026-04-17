import * as React from "react";
import AlertDialog from "./Alert";
import { useShellUi } from "./ShellUiContext";

export const AppAlertHost: React.FC = () => {
    const {
        alertOpen,
        alertTitle,
        alertMessage,
        hideAlert
    } = useShellUi();

    const handleClose = async (): Promise<boolean> => {
        await hideAlert();
        return true;
    };

    return (
        <AlertDialog
            open={alertOpen}
            title={alertTitle}
            message={alertMessage}
            onClose={handleClose}
        />
    );
};