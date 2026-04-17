import * as React from "react";
import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import { ContextInfo } from "gd-sprest";
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { Configuration } from "./data/cfg";
import { InstallationRequired } from "dattatable";
import { AppLoad } from "./AppLoad";
import { formatError } from "./common/utils";

type InstallState = "checking" | "ready" | "blocked" | "error";

export interface IAppBootProps {
    context: WebPartContext;
    appTitle: string;
    useDarkTheme: boolean;
    setUseDarkTheme: (value: boolean) => void;
    onError: (title: string, message: string) => boolean;
}

export const AppBoot: React.FC<IAppBootProps> = ({
    context,
    appTitle,
    useDarkTheme,
    setUseDarkTheme,
    onError
}): JSX.Element => {
    const [installState, setInstallState] = React.useState<InstallState>("checking");

    React.useEffect((): void => {
        const checkInstall = async (): Promise<void> => {
            setInstallState("checking");

            try {
                const hasPermission = ContextInfo.isSiteOwner || ContextInfo.isSiteAdmin;

                if (!hasPermission) {
                    setInstallState("ready");
                    return;
                }

                Configuration.setWebUrl(ContextInfo.webServerRelativeUrl);
                const needsInstall = await InstallationRequired.requiresInstall({ cfg: Configuration });

                if (needsInstall) {
                    InstallationRequired.showDialog();
                    setInstallState("blocked");
                    return;
                }

                setInstallState("ready");
            } catch (error) {
                onError("Error checking App configuration", formatError(error));
                setInstallState("error");
            }
        };

        checkInstall().catch((error) => {
            onError("Error checking App configuration", formatError(error));
            setInstallState("error");
        });
    }, [onError]);

    if (!context?.pageContext?.web) {
        return (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
                <Alert severity="warning" sx={{ maxWidth: 900, width: "100%" }}>
                    Error initializing the application. Missing SharePoint context. Please refresh the browser.
                </Alert>
            </Box>
        );
    }

    if (installState === "checking") {
        return (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
                <Stack spacing={3} alignItems="center">
                    <CircularProgress size={80} thickness={4} enableTrackSlot color="info" />
                    <Typography variant="h5" fontWeight={500}>
                        Verifying App Configuration...
                    </Typography>
                </Stack>
            </Box>
        );
    }

    if (installState === "blocked") {
        return (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
                <Alert severity="info" variant="outlined" sx={{ maxWidth: 900, width: "100%" }}>
                    Installation or configuration is required before this app can run. If you are an admin, complete the setup dialog. Otherwise, contact your site admin.
                </Alert>
            </Box>
        );
    }

    if (installState === "error") {
        return (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
                <Alert severity="error" variant="outlined" sx={{ maxWidth: 900, width: "100%" }}>
                    Unable to validate installation/configuration. Please refresh the page. If the problem persists, contact support.
                </Alert>
            </Box>
        );
    }

    return (
        <AppLoad
            context={context}
            appTitle={appTitle}
            useDarkTheme={useDarkTheme}
            setUseDarkTheme={setUseDarkTheme}
            onError={onError}
        />
    );
};
