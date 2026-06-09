import * as React from "react";
import {
    AppBar,
    Avatar,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Menu,
    MenuItem,
    Stack,
    Toolbar,
    Typography
} from "@mui/material";
import HandshakeIcon from "@mui/icons-material/Handshake";
import DashboardIcon from "@mui/icons-material/Dashboard";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import WorkIcon from "@mui/icons-material/Work";
import ListAltIcon from "@mui/icons-material/ListAlt";
import RefreshIcon from "@mui/icons-material/Refresh";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import PeopleIcon from "@mui/icons-material/People";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import { NavLink, useHistory } from "react-router-dom";
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { IPersonaProps } from "@fluentui/react";
import { useIwa } from "../data/iwaContext";
import { AppUserService } from "../users/userService";
import { DataSource } from "../data/ds";
import { IPeoplePicker } from "../data/props";
import { formatError, persistThemeMode } from "../common/utils";
import { MuiPeoplePicker } from "./CustomPeoplePicker";
import AlertDialog from "./Alert";
import { useShellUi } from "./ShellUiContext";

export interface INavHeaderProps {
    context: WebPartContext;
    appTitle: string;
    useDarkTheme: boolean;
    setUseDarkTheme: (value: boolean) => void;
}

export const NavHeader: React.FC<INavHeaderProps> = ({
    context,
    appTitle,
    useDarkTheme,
    setUseDarkTheme
}): JSX.Element => {
    const theme = useTheme();
    const history = useHistory();
    const { showBusy, hideBusy } = useShellUi();
    const isSmall = useMediaQuery(theme.breakpoints.down("md"));
    const userGuideUrl = DataSource.UserGuide;
    const {
        clearAuthorizationDetailCache,
        clearDashboardActionsCache,
        clearMyActionsCache,
        currentUser,
        isRefreshing,
        refresh,
        refreshCurrentUser
    } = useIwa();

    const [showDialog, setShowDialog] = React.useState<boolean>(false);
    const [dialogTitle, setDialogTitle] = React.useState<string>("");
    const [dialogMessage, setDialogMessage] = React.useState<string>("");
    const [backups, setBackups] = React.useState<{ results: IPeoplePicker[]; }>({ results: [] });
    const [backupDialogOpen, setBackupDialogOpen] = React.useState<boolean>(false);
    const [menuAnchorEl, setMenuAnchorEl] = React.useState<HTMLElement | undefined>(undefined);
    const [backupSaving, setBackupSaving] = React.useState<boolean>(false);

    const peoplePickerContext = React.useMemo(() => ({
        absoluteUrl: context.pageContext.web.absoluteUrl,
        msGraphClientFactory: context.msGraphClientFactory,
        spHttpClient: context.spHttpClient
    }), [context.msGraphClientFactory, context.pageContext.web.absoluteUrl, context.spHttpClient]);

    React.useEffect((): undefined => {
        setBackups(currentUser?.backups ?? { results: [] });
        return undefined;
    }, [currentUser]);

    const setDialogProps = React.useCallback((title: string, message: string): void => {
        setDialogTitle(title);
        setDialogMessage(message);
        setShowDialog(true);
    }, []);

    const hideDialog = React.useCallback((): void => {
        setShowDialog(false);
    }, []);

    const brandedAccentColor = "#f9b818";
    const brandedAccentHoverColor = "#d99600";
    const brandedAccentContrastText = "#091e31";

    const navButtonSx = React.useMemo(() => ({
        fontSize: 14,
        lineHeight: 1.2,
        "&.active": {
            color: brandedAccentColor,
            borderColor: brandedAccentColor
        },
        "&:hover": {
            color: brandedAccentColor,
            backgroundColor: "rgba(242, 199, 68, 0.08)"
        }
    }), []);

    const headerBgColor = "#091e31";
    const headerBorderColor = "rgba(200, 220, 255, 0.18)";
    const headerTextColor = "#f9f9f9";
    const headerSecondaryColor = "rgba(255,255,255,0.65)";
    const headerAccentColor = brandedAccentColor;
    const currentRoleLabel = currentUser?.role === "admin"
        ? "Administrator"
        : currentUser?.role === "hr"
            ? "HR"
            : "User";

    const userPhotoUrl = React.useMemo((): string | undefined => {
        const email = currentUser?.user?.EMail || context.pageContext.user.email;

        if (!email) {
            return undefined;
        }

        return `${context.pageContext.web.absoluteUrl}/_layouts/15/userphoto.aspx?size=M&accountname=${encodeURIComponent(email)}`;
    }, [context.pageContext.user.email, context.pageContext.web.absoluteUrl, currentUser?.user?.EMail]);

    const handleToggleTheme = React.useCallback(async (): Promise<void> => {
        const next = !useDarkTheme;
        setUseDarkTheme(next);
        persistThemeMode(next ? "dark" : "light");

        try {
            await AppUserService.updateMyModePreference(next ? "dark" : "light");
        } catch (error) {
            setDialogProps("Theme Preference Error", formatError(error));
        }
    }, [setDialogProps, setUseDarkTheme, useDarkTheme]);

    const handleRefresh = React.useCallback(async (): Promise<void> => {
        showBusy("Refreshing application data...");

        try {
            clearAuthorizationDetailCache();
            clearDashboardActionsCache();
            clearMyActionsCache();
            await refresh(true);
        } finally {
            hideBusy();
        }
    }, [clearAuthorizationDetailCache, clearDashboardActionsCache, clearMyActionsCache, hideBusy, refresh, showBusy]);

    const handleBackupOpen = React.useCallback((): void => {
        setBackups(currentUser?.backups ?? { results: [] });
        setBackupDialogOpen(true);
    }, [currentUser?.backups]);

    const hasBackupChanges = React.useMemo((): boolean => {
        const originalIds = (currentUser?.backups?.results ?? []).map((backup: IPeoplePicker): number => backup.Id).sort((left, right) => left - right);
        const selectedIds = (backups.results ?? []).map((backup: IPeoplePicker): number => backup.Id).sort((left, right) => left - right);

        if (originalIds.length !== selectedIds.length) {
            return true;
        }

        return originalIds.some((id: number, index: number): boolean => id !== selectedIds[index]);
    }, [backups.results, currentUser?.backups?.results]);

    const canSaveBackups = hasBackupChanges && !backupSaving;

    const handleBackupClose = React.useCallback((): void => {
        setBackupDialogOpen(false);
    }, []);

    const handleMenuOpen = React.useCallback((event: React.MouseEvent<HTMLElement>): void => {
        setMenuAnchorEl(event.currentTarget);
    }, []);

    const handleMenuClose = React.useCallback((): void => {
        setMenuAnchorEl(undefined);
    }, []);

    const handleBackups = React.useCallback((items: IPersonaProps[]): void => {
        const selectedPeople = items
            .filter((item: IPersonaProps): boolean => !!item.id && !!item.secondaryText && !!item.text)
            .map((item: IPersonaProps): IPeoplePicker => ({
                Id: parseInt(item.id!, 10),
                EMail: item.secondaryText!,
                Title: item.text!,
                id: item.id,
                text: item.text!,
                secondaryText: item.secondaryText!
            }));

        setBackups({ results: selectedPeople });
    }, []);

    const handleSaveBackups = React.useCallback(async (): Promise<void> => {
        if (!currentUser?.Id) {
            return;
        }

        setBackupSaving(true);

        try {
            await AppUserService.updateBackups(currentUser.Id, backups);
            await refreshCurrentUser();
            handleBackupClose();
        } catch (error) {
            setDialogProps("Error Saving Backups", formatError(error));
        } finally {
            setBackupSaving(false);
        }
    }, [backups, currentUser?.Id, handleBackupClose, refreshCurrentUser, setDialogProps]);

    const handleNewAuthorization = React.useCallback((): void => {
        history.push("/authorizations/new");
    }, [history]);

    return (
        <AppBar
            position="sticky"
            elevation={1}
            sx={{
                top: 0,
                zIndex: theme.zIndex.drawer + 1,
                borderRadius: 0,
                border: "2px solid",
                borderColor: headerBorderColor,
                backgroundColor: headerBgColor,
                color: headerTextColor,
                width: "100%"
            }}
        >
            <Toolbar
                sx={{
                    width: "100%",
                    px: { xs: 1.5, md: 2 },
                    py: 1,
                    gap: 1.5,
                    justifyContent: "space-between",
                    alignItems: "center"
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, flex: 1, overflow: "hidden" }}>
                    <HandshakeIcon sx={{ fontSize: 38, color: "inherit" }} />
                    <Typography
                        variant={isSmall ? "h5" : "h4"}
                        sx={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
                        noWrap
                    >
                        {appTitle}
                    </Typography>
                </Box>

                <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0, flexShrink: 0, ml: 1 }}>
                    <Avatar
                        src={userPhotoUrl}
                        alt={context.pageContext.user.displayName}
                        slotProps={{ img: { referrerPolicy: "no-referrer" } }}
                        sx={{ width: 38, height: 38 }}
                    >
                        <PersonOutlineIcon fontSize="small" />
                    </Avatar>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", minWidth: 0 }}>
                        {!isSmall && (
                            <Stack spacing={0} sx={{ minWidth: 0, maxWidth: 220, alignItems: "flex-end" }}>
                                <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                                    {context.pageContext.user.displayName}
                                </Typography>
                                <Typography variant="caption" sx={{ color: headerSecondaryColor }} noWrap>
                                    {currentRoleLabel}
                                </Typography>
                            </Stack>
                        )}
                        <IconButton
                            onClick={handleMenuOpen}
                            size="medium"
                            aria-label="Header Actions"
                            title="Header Actions"
                            sx={{ color: headerAccentColor }}
                        >
                            <MoreVertIcon />
                        </IconButton>
                    </Stack>
                </Stack>
            </Toolbar>

            <Toolbar
                sx={{
                    width: "100%",
                    px: { xs: 1.5, md: 2 },
                    paddingBottom: 1,
                    borderBottom: `3px solid ${theme.palette.mode === "dark" ? theme.palette.primary.main : theme.palette.secondary.main}`,
                    minHeight: 0,
                    gap: 1.5,
                    justifyContent: "space-between",
                    alignItems: { xs: "stretch", md: "center" },
                    flexDirection: { xs: "column", md: "row" },
                    "&.MuiToolbar-root": {
                        minHeight: 0
                    }
                }}
            >
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                        alignItems: "center",
                        justifyContent: "flex-start",
                        flexWrap: "wrap",
                        width: { xs: "100%", md: "auto" },
                        "& .MuiButton-root": {
                            color: headerTextColor
                        }
                    }}
                >
                    <Button title="My Work" startIcon={<WorkIcon />} color="inherit" component={NavLink} to="/my-work" sx={navButtonSx}>
                        {!isSmall && "My Work"}
                    </Button>
                    <Button title="All Authorizations" startIcon={<ListAltIcon />} color="inherit" component={NavLink} to="/all-authorizations" sx={navButtonSx}>
                        {!isSmall && "All Authorizations"}
                    </Button>
                    <Button title="Dashboard" startIcon={<DashboardIcon />} color="inherit" component={NavLink} to="/dashboard" sx={navButtonSx}>
                        {!isSmall && "Dashboard"}
                    </Button>
                    {currentUser?.role === "admin" && (
                        <Button title="Admin" startIcon={<AdminPanelSettingsIcon />} color="inherit" component={NavLink} to="/admin" sx={navButtonSx}>
                            {!isSmall && "Admin"}
                        </Button>
                    )}
                </Stack>

                <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                        alignItems: "center",
                        justifyContent: "flex-end",
                        width: { xs: "100%", md: "auto" },
                        "& .MuiIconButton-root": {
                            color: headerAccentColor
                        }
                    }}
                >
                    <IconButton
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        size="medium"
                        aria-label="Refresh Data"
                        title={isRefreshing ? "Refreshing..." : "Refresh Data"}
                    >
                        <RefreshIcon sx={{ animation: isRefreshing ? "spin 1s linear infinite" : undefined }} />
                    </IconButton>
                    <Button
                        variant="contained"
                        startIcon={<AddOutlinedIcon />}
                        onClick={handleNewAuthorization}
                        sx={{
                            fontSize: 14,
                            whiteSpace: "nowrap",
                            bgcolor: brandedAccentColor,
                            color: brandedAccentContrastText,
                            "&:hover": {
                                bgcolor: brandedAccentHoverColor
                            }
                        }}
                    >
                        New Authorization
                    </Button>
                </Stack>
            </Toolbar>

            <Menu
                anchorEl={menuAnchorEl}
                open={!!menuAnchorEl}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
                <MenuItem
                    onClick={() => {
                        handleMenuClose();

                        if (!userGuideUrl) {
                            return;
                        }

                        window.open(userGuideUrl, "_blank", "noopener,noreferrer");
                    }}
                    disabled={!userGuideUrl}
                >
                    <HelpOutlineOutlinedIcon fontSize="small" sx={{ mr: 1.25 }} />
                    Help
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        handleMenuClose();
                        handleBackupOpen();
                    }}
                >
                    {currentUser?.hasBackup ? (
                        <PeopleIcon fontSize="small" sx={{ mr: 1.25 }} />
                    ) : (
                        <PeopleOutlineIcon fontSize="small" sx={{ mr: 1.25 }} />
                    )}
                    Backups
                </MenuItem>
                <MenuItem
                    onClick={async () => {
                        handleMenuClose();
                        await handleToggleTheme();
                    }}
                >
                    {useDarkTheme ? (
                        <LightModeIcon fontSize="small" sx={{ mr: 1.25 }} />
                    ) : (
                        <DarkModeIcon fontSize="small" sx={{ mr: 1.25 }} />
                    )}
                    {useDarkTheme ? "Light Mode" : "Dark Mode"}
                </MenuItem>
            </Menu>

            <Dialog
                open={backupDialogOpen}
                onClose={handleBackupClose}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>Manage Backups</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            Select one or more backup approvers for your account.
                        </Typography>

                        <MuiPeoplePicker
                            label="Backup(s)"
                            context={peoplePickerContext}
                            value={backups.results?.length ? backups.results.map(b => b.EMail) : []}
                            onChange={handleBackups}
                            helperText="Leave blank to remove all backups"
                            selectionLimit={5}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleBackupClose} color="inherit">
                        Cancel
                    </Button>
                    <Button variant="contained" onClick={handleSaveBackups} disabled={!canSaveBackups}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            <AlertDialog open={showDialog} title={dialogTitle} message={dialogMessage} onClose={hideDialog} />
        </AppBar>
    );
};
