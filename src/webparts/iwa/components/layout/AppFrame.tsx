import * as React from "react";
import { Box, Typography } from "@mui/material";
import { Redirect, Route, Switch, useLocation } from "react-router-dom";
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
import { IModItem } from "../data/props";

const scrollElementToTop = (element?: Element | Window): void => {
    if (!element) {
        return;
    }

    if (element === window) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        return;
    }

    (element as HTMLElement).scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    (element as HTMLElement).scrollTop = 0;
    (element as HTMLElement).scrollLeft = 0;
};

const getScrollableAncestors = (element?: HTMLElement): HTMLElement[] => {
    const ancestors: HTMLElement[] = [];
    let current = element?.parentElement;

    while (current) {
        const style = window.getComputedStyle(current);
        const canScrollY = /(auto|scroll|overlay)/i.test(style.overflowY) || current.scrollHeight > current.clientHeight;

        if (canScrollY) {
            ancestors.push(current);
        }

        current = current.parentElement;
    }

    return ancestors;
};

const scrollAppToTop = (mainElement?: HTMLElement): void => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    scrollElementToTop(document.scrollingElement ?? undefined);
    document
        .querySelectorAll<HTMLElement>("[data-automation-id='contentScrollRegion'], [data-automation-id='CanvasZone'], .CanvasComponent")
        .forEach(scrollElementToTop);
    getScrollableAncestors(mainElement).forEach(scrollElementToTop);
    mainElement?.focus({ preventScroll: true });
};

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
    const location = useLocation();
    const mainRef = React.useRef<HTMLElement | null>(null);
    const {
        appUsers,
        authorizations,
        currentUser,
        draftAuthorizations,
        draftModsByAuthorizationId,
        isAppUsersLoading,
        isRefreshing,
        modsByAuthorizationId
    } = useIwa();
    const allEditableAuthorizations = React.useMemo(() => {
        return [...draftAuthorizations, ...authorizations];
    }, [authorizations, draftAuthorizations]);

    React.useEffect(() => {
        const scroll = (): void => scrollAppToTop(mainRef.current ?? undefined);
        const frameId = window.requestAnimationFrame(scroll);
        const settleId = window.setTimeout(scroll, 75);

        return () => {
            window.cancelAnimationFrame(frameId);
            window.clearTimeout(settleId);
        };
    }, [location.pathname, location.search]);

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
                ref={mainRef}
                tabIndex={-1}
                sx={{
                    width: "100%",
                    minHeight: "calc(100vh - 86px)",
                    bgcolor: "background.default",
                    px: { xs: 2, md: 3 },
                    pt: 3,
                    pb: 3,
                    outline: "none"
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
                            const routeState = routeProps.location.state as { modId?: number; mod?: IModItem; } | undefined;
                            const requestedModId = routeState?.modId;
                            const cachedMod = requestedModId
                                ? modsByAuthorizationId.get(Number(id))?.find((candidate) => candidate.Id === requestedModId)
                                : undefined;
                            const draftMod = draftModsByAuthorizationId.get(Number(id));
                            const modCandidates = [cachedMod, routeState?.mod, draftMod].filter((candidate): candidate is IModItem => !!candidate);
                            const mod = modCandidates.find((candidate) => !!candidate.Author?.Id) ?? modCandidates[0];

                            if (isRefreshing || isAppUsersLoading) {
                                return <Typography color="text.secondary">Checking edit access...</Typography>;
                            }

                            if (!item) {
                                return <NotFoundPage />;
                            }

                            if (!canUserEditAuthorization(item, currentUser, appUsers, mod)) {
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
