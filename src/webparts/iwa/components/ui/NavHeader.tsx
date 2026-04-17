import * as React from "react";
import {
    AppBar,
    Avatar,
    Box,
    Button,
    IconButton,
    InputAdornment,
    Menu,
    MenuItem,
    Popover,
    Stack,
    TextField,
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
import SearchIcon from "@mui/icons-material/Search";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import PeopleIcon from "@mui/icons-material/People";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { NavLink } from "react-router-dom";
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { IPersonaProps } from "@fluentui/react";
import { useIwa } from "../data/iwaContext";
import { AppUserService } from "../users/userService";
import { DataSource } from "../data/ds";
import { IPeoplePicker } from "../data/props";
import { formatError } from "../common/utils";
import { MuiPeoplePicker } from "./CustomPeoplePicker";
import AlertDialog from "./Alert";

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
    const [backupAnchorEl, setBackupAnchorEl] = React.useState<HTMLElement | undefined>(undefined);
    const [menuAnchorEl, setMenuAnchorEl] = React.useState<HTMLElement | undefined>(undefined);
    const [backupSaving, setBackupSaving] = React.useState<boolean>(false);
    const [searchText, setSearchText] = React.useState<string>("");

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

    const navButtonSx = React.useMemo(() => ({
        "&.active": {
            color: theme.palette.warning.main
        },
        "&:hover": {
            color: theme.palette.warning.main,
            backgroundColor: "rgba(242, 199, 68, 0.08)"
        }
    }), [theme.palette.warning.main]);

    const navIconColor = theme.palette.mode === "light"
        ? "#00b7ff"
        : theme.palette.action.active;

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
        sessionStorage.setItem("iwa_theme", next ? "dark" : "light");

        try {
            await AppUserService.updateMyModePreference(next ? "dark" : "light");
        } catch (error) {
            setDialogProps("Theme Preference Error", formatError(error));
        }
    }, [setDialogProps, setUseDarkTheme, useDarkTheme]);

    const handleRefresh = React.useCallback(async (): Promise<void> => {
        clearAuthorizationDetailCache();
        clearDashboardActionsCache();
        clearMyActionsCache();
        await refresh(true);
    }, [clearAuthorizationDetailCache, clearDashboardActionsCache, clearMyActionsCache, refresh]);

    const handleBackupOpen = React.useCallback((event: React.MouseEvent<HTMLElement>): void => {
        setBackupAnchorEl(event.currentTarget);
    }, []);

    const handleBackupClose = React.useCallback((): void => {
        setBackupAnchorEl(undefined);
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

    return (
        <AppBar
            position="static"
            elevation={1}
            sx={{
                borderRadius: 0,
                border: "1px solid",
                borderColor: "divider"
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
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                    <HandshakeIcon sx={{ fontSize: 38, color: "inherit" }} />
                    <Typography variant={isSmall ? "h6" : "h5"} sx={{ fontWeight: 600 }} noWrap>
                        {appTitle}
                    </Typography>
                </Box>

                <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
                    <Avatar
                        src={userPhotoUrl}
                        alt={context.pageContext.user.displayName}
                        slotProps={{ img: { referrerPolicy: "no-referrer" } }}
                        sx={{ width: 38, height: 38 }}
                    >
                        <PersonOutlineIcon fontSize="small" />
                    </Avatar>
                    {!isSmall && (
                        <Stack spacing={0} sx={{ minWidth: 0, alignItems: "flex-end" }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                                {context.pageContext.user.displayName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                                {currentUser?.role === "admin" ? "Administrator" : "User"}
                            </Typography>
                        </Stack>
                    )}
                </Stack>
            </Toolbar>

            <Toolbar
                sx={{
                    width: "100%",
                    px: { xs: 1.5, md: 2 },
                    paddingBottom: .5,
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
                        width: { xs: "100%", md: "auto" }
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
                            color: navIconColor
                        }
                    }}
                >
                    <TextField
                        size="small"
                        placeholder="Search IWA authorizations"
                        value={searchText}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>): void => setSearchText(event.target.value)}
                        sx={{
                            minWidth: { xs: 0, sm: 260, md: 320 },
                            maxWidth: { xs: "100%", md: 360 },
                            flexGrow: { xs: 1, md: 0 },
                            "& .MuiOutlinedInput-root": {
                                backgroundColor: theme.palette.background.paper
                            }
                        }}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" />
                                    </InputAdornment>
                                )
                            }
                        }}
                    />

                    <IconButton
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        size="medium"
                        aria-label="Refresh Data"
                        title={isRefreshing ? "Refreshing..." : "Refresh Data"}
                    >
                        <RefreshIcon sx={{ animation: isRefreshing ? "spin 1s linear infinite" : undefined }} />
                    </IconButton>

                    <IconButton
                        onClick={handleMenuOpen}
                        size="medium"
                        aria-label="Header Actions"
                        title="Header Actions"
                    >
                        <MoreVertIcon />
                    </IconButton>
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
                    onClick={(event: React.MouseEvent<HTMLElement>) => {
                        handleMenuClose();
                        handleBackupOpen(event);
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

            <Popover
                open={!!backupAnchorEl}
                anchorEl={backupAnchorEl}
                onClose={handleBackupClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 1.5,
                            width: { xs: 320, sm: 450 },
                            p: 2,
                            borderRadius: 2,
                            boxShadow: theme.shadows[8]
                        }
                    }
                }}
            >
                <Stack spacing={2}>
                    <Box>
                        <Typography variant="subtitle1" fontWeight={600}>
                            Manage Backups
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Select one or more backup approvers for your account.
                        </Typography>
                    </Box>

                    <MuiPeoplePicker
                        label="Backup(s)"
                        context={peoplePickerContext}
                        value={backups.results?.length ? backups.results.map(b => b.EMail) : []}
                        required
                        onChange={handleBackups}
                        helperText="Select one or more backups"
                        selectionLimit={5}
                    />

                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button onClick={handleBackupClose} color="inherit">
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={handleSaveBackups} disabled={backupSaving}>
                            Save
                        </Button>
                    </Stack>
                </Stack>
            </Popover>

            <AlertDialog open={showDialog} title={dialogTitle} message={dialogMessage} onClose={hideDialog} />
        </AppBar>
    );
};
