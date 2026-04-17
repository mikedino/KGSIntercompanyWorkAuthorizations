import * as React from "react";
import { Alert, Box } from "@mui/material";
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { persistThemeMode } from "./common/utils";
import { IwaProvider, useIwa } from "./data/iwaContext";
import { AppAlertHost } from "./ui/AppAlertHost";
import { AppBackdropHost } from "./ui/AppBackdrop";
import { AppFrame } from "./layout/AppFrame";
import { BrandedLoadingState } from "./ui/BrandedLoadingState";

export interface IAppLoadProps {
    context: WebPartContext;
    appTitle: string;
    useDarkTheme: boolean;
    setUseDarkTheme: (value: boolean) => void;
    onError: (title: string, message: string) => boolean;
}

const ThemeSync: React.FC<{ setUseDarkTheme: (value: boolean) => void; }> = ({ setUseDarkTheme }): JSX.Element => {
    const { appUser, isBootLoading } = useIwa();

    React.useEffect((): undefined => {
        if (isBootLoading || !appUser) {
            return undefined;
        }

        const isDark = appUser.modePreference === "dark";
        setUseDarkTheme(isDark);
        persistThemeMode(isDark ? "dark" : "light");
        return undefined;
    }, [appUser, isBootLoading, setUseDarkTheme]);

    return <></>;
};

const AppLoadState: React.FC<Pick<IAppLoadProps, "context" | "appTitle" | "setUseDarkTheme" | "useDarkTheme">> = ({
    context,
    appTitle,
    setUseDarkTheme,
    useDarkTheme
}): JSX.Element => {
    const { fatalError, isBootLoading } = useIwa();

    if (fatalError) {
        return (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
                <Alert severity="error" variant="outlined" sx={{ maxWidth: 900, width: "100%" }}>
                    Failed to load application data. Please refresh the page. If the problem persists, contact support.
                </Alert>
            </Box>
        );
    }

    if (isBootLoading) {
        return <BrandedLoadingState message="Loading IWA Application..." useDarkTheme={useDarkTheme} />;
    }

    return (
        <>
            <ThemeSync setUseDarkTheme={setUseDarkTheme} />
            <AppFrame
                context={context}
                appTitle={appTitle}
                useDarkTheme={useDarkTheme}
                setUseDarkTheme={setUseDarkTheme}
            />
        </>
    );
};

export const AppLoad: React.FC<IAppLoadProps> = ({
    context,
    appTitle,
    useDarkTheme,
    setUseDarkTheme,
    onError
}): JSX.Element => {
    return (
        <IwaProvider enabled onError={onError}>
            <AppAlertHost />
            <AppBackdropHost />
            <AppLoadState
                context={context}
                appTitle={appTitle}
                useDarkTheme={useDarkTheme}
                setUseDarkTheme={setUseDarkTheme}
            />
        </IwaProvider>
    );
};
