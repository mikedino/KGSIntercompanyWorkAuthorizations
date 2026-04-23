import * as React from "react";
import { Box } from "@mui/material";
import { Redirect, Route, Switch } from "react-router-dom";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { NavHeader } from "../ui/NavHeader";
import { MyWorkPage } from "./MyWorkPage";
import { AllAuthorizationsPage } from "./AllAuthorizationsPage";
import { DashboardPage } from "./DashboardPage";
import AdminPage from "../admin/AdminPage";
import { NotFoundPage } from "../ui/NotFoundPage";
import { IwaForm } from "../authorizations/iwaForm";
import { IwaDetailPage } from "../authorizations/IwaDetailPage";
import { useIwa } from "../data/iwaContext";

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
    const { authorizations, draftAuthorizations } = useIwa();
    const allEditableAuthorizations = React.useMemo(() => {
        return [...draftAuthorizations, ...authorizations];
    }, [authorizations, draftAuthorizations]);

    return (
        <>
            <NavHeader
                context={context}
                appTitle={appTitle}
                useDarkTheme={useDarkTheme}
                setUseDarkTheme={setUseDarkTheme}
            />

            <Box
                sx={{
                    width: "100%",
                    px: { xs: 2, md: 3 },
                    pt: 3,
                    pb: 3
                }}
            >
                <Box sx={{ mx: "auto", maxWidth: "1600px" }}>
                    <Switch>
                        <Route exact path="/">
                            <Redirect to="/my-work/all" />
                        </Route>
                        <Route exact path="/my-work">
                            <Redirect to="/my-work/all" />
                        </Route>
                        <Route path="/my-work/:view" component={MyWorkPage} />
                        <Route exact path="/all-authorizations">
                            <Redirect to="/all-authorizations/all" />
                        </Route>
                        <Route path="/all-authorizations/:view" component={AllAuthorizationsPage} />
                        <Route path="/authorizations/new" render={() => (
                            <LocalizationProvider dateAdapter={AdapterDayjs}>
                                <IwaForm context={context} mode="new" />
                            </LocalizationProvider>
                        )} />
                        <Route path="/authorizations/edit/:id" render={(routeProps) => {
                            const id = routeProps.match.params.id;
                            const item = allEditableAuthorizations.find((authorization) => authorization.Id.toString() === id);

                            if (!item) {
                                return <NotFoundPage />;
                            }

                            return (
                                <LocalizationProvider dateAdapter={AdapterDayjs}>
                                    <IwaForm context={context} mode="edit" item={item} />
                                </LocalizationProvider>
                            );
                        }} />
                        <Route path="/authorizations/view/:id" component={IwaDetailPage} />
                        <Route path="/dashboard" component={DashboardPage} />
                        <Route path="/admin" render={() => <AdminPage context={context} />} />
                        <Route component={NotFoundPage} />
                    </Switch>
                </Box>
            </Box>
        </>
    );
};
