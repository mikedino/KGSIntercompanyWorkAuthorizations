import * as React from "react";
import { Box } from "@mui/material";
import { Redirect, Route, Switch } from "react-router-dom";
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { NavHeader } from "./ui/NavHeader";
import { MyWorkPage } from "./authorizations/MyWorkPage";
import { AllAuthorizationsPage } from "./authorizations/AllAuthorizationsPage";
import { DashboardPage } from "./authorizations/DashboardPage";
import AdminPage from "./admin/AdminPage";
import { NotFoundPage } from "./ui/NotFoundPage";

export interface IAppFrameProps {
    context: WebPartContext;
    appTitle: string;
    useDarkTheme: boolean;
    setUseDarkTheme: (value: boolean) => void;
}

export const AppFrame: React.FC<IAppFrameProps> = ({
    context,
    appTitle,
    useDarkTheme,
    setUseDarkTheme
}): JSX.Element => {
    return (
        <>
            <NavHeader
                context={context}
                appTitle={appTitle}
                useDarkTheme={useDarkTheme}
                setUseDarkTheme={setUseDarkTheme}
            />

            <Box sx={{ width: "100%", px: { xs: 2, md: 3 }, py: 3 }}>
                <Box sx={{ mx: "auto", maxWidth: "1600px" }}>
                    <Switch>
                        <Route exact path="/">
                            <Redirect to="/my-work" />
                        </Route>
                        <Route path="/my-work" component={MyWorkPage} />
                        <Route path="/all-authorizations" component={AllAuthorizationsPage} />
                        <Route path="/dashboard" component={DashboardPage} />
                        <Route path="/admin" render={() => <AdminPage context={context} />} />
                        <Route component={NotFoundPage} />
                    </Switch>
                </Box>
            </Box>
        </>
    );
};
