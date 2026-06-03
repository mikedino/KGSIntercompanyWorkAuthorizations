import * as React from "react";
import { Box, CssBaseline, ThemeProvider } from "@mui/material";
import type { IIwaAppProps } from "./data/props";
import Strings from "./common/strings";
import { getStoredThemeMode } from "./common/utils";
import { ShellUiProvider, useShellUi } from "./ui/ShellUiContext";
import { darkTheme } from "./styles/darkTheme";
import { lightTheme } from "./styles/lightTheme";
import { AppBoot } from "./AppBoot";

/**
 * APPLICATION OUTER PROVIDER/SHELL
 * 
 * 1 - App → outer shell only
 * 2 - AppBoot → install/config gate
 * 3 - AppLoad → data/context boot
 * 4 - AppFrame → shared layout/theme wrapper
 * 
 */

const AppShell: React.FC<IIwaAppProps> = ({ context }): React.ReactElement => {
    const { showAlert } = useShellUi();
    const [useDarkTheme, setUseDarkTheme] = React.useState<boolean>(() => {
        const cached = getStoredThemeMode();
        if (cached === "dark") return true;
        if (cached === "light") return false;
        return false;
    });

    return (
        <ThemeProvider theme={useDarkTheme ? darkTheme : lightTheme}>
            <CssBaseline />
            <Box
                sx={{
                    "--iwa-app-bg": (theme) => theme.palette.background.default,
                    minHeight: "100vh",
                    bgcolor: "background.default",
                    color: "text.primary"
                }}
            >
                <AppBoot
                    context={context}
                    appTitle={Strings.ProjectName}
                    useDarkTheme={useDarkTheme}
                    setUseDarkTheme={setUseDarkTheme}
                    onError={showAlert}
                />
            </Box>
        </ThemeProvider>
    );
};

export const App: React.FC<IIwaAppProps> = ({ description, context }): React.ReactElement => {
    return (
        <ShellUiProvider>
            <AppShell description={description} context={context} />
        </ShellUiProvider>
    );
};
