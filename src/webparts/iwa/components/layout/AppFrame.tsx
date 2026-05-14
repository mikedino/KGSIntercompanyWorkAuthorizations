import * as React from "react";
import { Box, Typography } from "@mui/material";
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
import { IwaExportPreviewPage } from "../authorizations/export/IwaExportPreviewPage";
import { useIwa } from "../data/iwaContext";
import Strings from "../common/strings";
import { canUserEditAuthorization } from "../authorizations/authorizationEditAccess";

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
    const { appUsers, authorizations, currentUser, draftAuthorizations, isAppUsersLoading, isRefreshing } = useIwa();
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
                component="main"
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
                            <Redirect to="/my-work/needsAction" />
                        </Route>
                        <Route exact path="/my-work">
                            <Redirect to="/my-work/needsAction" />
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

                            if (isRefreshing || isAppUsersLoading) {
                                return <Typography color="text.secondary">Checking edit access...</Typography>;
                            }

                            if (!item) {
                                return <NotFoundPage />;
                            }

                            if (!canUserEditAuthorization(item, currentUser, appUsers)) {
                                return <Redirect to={`/authorizations/view/${item.Id}`} />;
                            }

                            return (
                                <LocalizationProvider dateAdapter={AdapterDayjs}>
                                    <IwaForm context={context} mode="edit" item={item} />
                                </LocalizationProvider>
                            );
                        }} />
                        <Route path="/authorizations/view/:id" component={IwaDetailPage} />
                        <Route path="/authorizations/export/:id" component={IwaExportPreviewPage} />
                        <Route path="/dashboard" component={DashboardPage} />
                        <Route path="/admin" render={() => <AdminPage context={context} />} />
                        <Route component={NotFoundPage} />
                    </Switch>

                    <Typography sx={{ width: "100%", mt: 2, textAlign: "right", fontSize: 10 }} >App Version: {Strings.Version}</Typography>

                </Box>
            </Box>
        </>
    );
};
