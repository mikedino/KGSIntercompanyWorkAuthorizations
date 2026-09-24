import * as React from "react";
import { flushSync } from "react-dom";
import {
    Box, BottomNavigation, BottomNavigationAction, Button, Chip, CircularProgress, Divider, Dialog, DialogActions,
    DialogContent, DialogTitle, Link, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { alpha, useTheme } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import ContentPasteGoOutlinedIcon from "@mui/icons-material/ContentPasteGoOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import { useIwa } from "../data/iwaContext";
import { DataSource } from "../data/ds";
import { IModItem } from "../data/props";
import { consumeWorkflowListsStale, formatDate, formatError, formatRelationship, formatSinceDate, getFirstNameFromDisplayName } from "../common/utils";
import { PageHeader } from "../ui/PageHeader";
import { Link as RouterLink, useHistory, useParams } from "react-router-dom";
import { AuthorizationService } from "../authorizations/iwaService";
import { canUserEditAuthorization } from "../authorizations/authorizationEditAccess";
import { canCancelMod, canDeleteAuthorization } from "../authorizations/authorizationDeleteAccess";
import { ModService } from "../mods/modService";
import { useShellUi } from "../ui/ShellUiContext";
import { ConfirmDeleteDialog } from "../admin/ConfirmDeleteDialog";
import {
    authorizationStatusLabels,
    buildMyWorkSummary,
    filterMyWorkRows,
    getLatestActionSummary,
    getPendingLabel,
    getRunScopeLabel,
    getStatusChipColor,
    IMyWorkRow,
    MyWorkPresetView
} from "./myWorkUtils";
import { formatModLabel } from "../authorizations/view/iwaViewUtils";

interface IMyWorkSummaryCardProps {
    title: string;
    value: number;
    helperText: string;
    icon: React.ReactNode;
    isSelected: boolean;
    onClick: () => void;
}

const MyWorkSummaryCard: React.FC<IMyWorkSummaryCardProps> = ({
    title,
    value,
    helperText,
    icon,
    isSelected,
    onClick
}): JSX.Element => {
    const theme = useTheme();
    const isCompact = useMediaQuery(theme.breakpoints.down("lg"));
    const hideHelperText = useMediaQuery(theme.breakpoints.down("md"));

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
        }
    };

    return (
        <Paper
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            sx={{
                p: { xs: 1.25, sm: 1.5, md: 1.75 },
                borderRadius: 3,
                height: "100%",
                cursor: "pointer",
                border: "1px solid",
                borderColor: isSelected ? "primary.main" : "transparent",
                backgroundColor: isSelected ? alpha(theme.palette.primary.main, 0.08) : "background.paper",
                transition: "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
                "&:hover": {
                    borderColor: isSelected ? "primary.main" : alpha(theme.palette.primary.main, 0.55),
                    backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.14 : 0.08),
                    boxShadow: theme.palette.mode === "dark"
                        ? "inset 0 0 0 1px rgba(255,255,255,0.04)"
                        : "inset 0 0 0 1px rgba(255,255,255,0.45)"
                },
                "&:focus-visible": {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: 2
                }
            }}
        >
            <Stack spacing={isCompact ? 1 : 1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.2, pr: 0.75 }}
                    >
                        {title}
                    </Typography>
                    <Stack direction="row" spacing={0.25} alignItems="center">
                        {hideHelperText && (
                            <Tooltip title={helperText} arrow placement="top">
                                <Box
                                    sx={{
                                        color: "text.secondary",
                                        display: "flex",
                                        p: 0.25
                                    }}
                                >
                                    <InfoOutlinedIcon fontSize="inherit" />
                                </Box>
                            </Tooltip>
                        )}
                        <Box
                            sx={{
                                color: "info.main",
                                display: "flex",
                                alignItems: "center",
                                "& svg": {
                                    fontSize: isCompact ? 20 : 24
                                }
                            }}
                        >
                            {icon}
                        </Box>
                    </Stack>
                </Stack>
                <Typography variant={isCompact ? "h5" : "h4"} fontWeight={700} lineHeight={1}>
                    {value}
                </Typography>
                {!hideHelperText && (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            lineHeight: 1.3,
                            //minHeight: isCompact ? 34 : 40
                        }}
                    >
                        {helperText}
                    </Typography>
                )}
            </Stack>
        </Paper>
    );
};

const presetViews: Array<{ value: MyWorkPresetView; label: string; }> = [
    { value: "needsAction", label: "Needs My Action" },
    { value: "all", label: "All My Work" },
    { value: "backupCoverage", label: "Backup Coverage" },
    { value: "created", label: "Created By Me" },
    { value: "activity", label: "My Activity" },
    { value: "activeWorkflow", label: "Active Workflow" },
    { value: "closed", label: "Recently Closed" }
];

const defaultPresetView: MyWorkPresetView = "needsAction";
const deleteSuccessDurationMs = 7000;

const isPresetView = (value: string | undefined): value is MyWorkPresetView => {
    return presetViews.some((view) => view.value === value);
};

const formatPresetViewLabel = (label: string, count: number): string => `${label} (${count})`;

const hasModIndicator = (row: IMyWorkRow): boolean => {
    return row.isModDraft || row.currentRun?.runType === "mod" || (row.authorization.modCount ?? 0) > 0;
};

const getModIndicatorLabel = (row: IMyWorkRow): string => {
    if (row.isModDraft && row.draftMod?.modNumber) {
        return formatModLabel(row.draftMod.modNumber);
    }

    if (row.currentRun?.runType === "mod" && row.currentRun.mod?.Title) {
        return row.currentRun.mod.Title.replace(/^.*MOD-/i, "M");
    }

    return formatModLabel(row.authorization.modCount);
};

const getMyWorkStatusLabel = (row: IMyWorkRow): string => {
    if (row.isModDraft) {
        return "Mod Draft";
    }

    if (row.currentRun?.runType === "mod") {
        if (row.currentRun.outcome === "rejected") {
            return "Mod Rejected";
        }

        switch (row.currentRun.runStatus) {
            case "active":
                return "Mod Submitted";
            case "completed":
                return "Mod Approved";
            case "rejected":
                return "Mod Rejected";
            case "canceled":
                return "Mod Canceled";
            case "superseded":
                return "Mod Superseded";
            default:
                return "Mod Submitted";
        }
    }

    return `Authorization ${authorizationStatusLabels[row.authorization.authorizationStatus]}`;
};

const getMyWorkStatusChipColor = (
    row: IMyWorkRow
): "default" | "success" | "warning" | "error" | "info" => {
    if (row.currentRun?.runType === "mod") {
        if (row.currentRun.outcome === "rejected") {
            return "error";
        }

        switch (row.currentRun.runStatus) {
            case "active":
                return "warning";
            case "completed":
                return "success";
            case "rejected":
            case "canceled":
                return "error";
            case "superseded":
                return "default";
            default:
                return "info";
        }
    }

    return getStatusChipColor(row.authorization.authorizationStatus);
};

const MyWorkMobileCard: React.FC<{
    row: IMyWorkRow;
    canResumeDraft: boolean;
    canEditActive: boolean;
    canDeleteIwa: boolean;
    canCancelModRequest: boolean;
    onResumeDraft: (id: number) => void;
    onEditActive: (row: IMyWorkRow) => void;
    onDiscardDraft: (row: IMyWorkRow) => void;
    onDeleteIwa: (row: IMyWorkRow) => void;
    onCancelMod: (row: IMyWorkRow) => void;
}> = ({ row, canResumeDraft, canEditActive, canDeleteIwa, canCancelModRequest, onResumeDraft, onEditActive, onDiscardDraft, onDeleteIwa, onCancelMod }): JSX.Element => {
    const resumeLabel = row.isModDraft ? "Resume Mod" : "Resume Draft";
    const discardLabel = row.isModDraft ? "Discard Mod" : "Discard Draft";
    const editLabel = row.currentRun?.runType === "mod" ? "Edit Mod" : "Edit IWA";

    return (
        <Paper sx={{ p: 2.25, borderRadius: 3 }}>
            <Stack spacing={1.5}>
                <Stack spacing={0.5}>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Link
                            component={RouterLink}
                            to={`/authorizations/view/${row.authorization.Id}`}
                            variant="h6"
                            fontWeight={600}
                            underline="hover"
                            color="primary"
                            sx={{ overflowWrap: "anywhere" }}
                        >
                            {row.authorization.Title}
                        </Link>
                        {hasModIndicator(row) && (
                            <Tooltip title={`${row.authorization.modCount ?? 0} modification(s)`}>
                                <Chip
                                    icon={<AccountTreeOutlinedIcon />}
                                    label={getModIndicatorLabel(row)}
                                    size="small"
                                    variant="outlined"
                                    sx={{ height: 22 }}
                                />
                            </Tooltip>
                        )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                        {row.authorization.contractName || "No contract title"} | {row.authorization.contractId || "No contract id"}
                    </Typography>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {row.relationshipBadges.map((badge: string): JSX.Element => (
                        <Chip
                            key={`${row.authorization.Id}-${badge}`}
                            label={badge}
                            color={badge.indexOf("Needs") === 0 ? "warning" : "info"}
                            size="small"
                            variant={badge.indexOf("Created") >= 0 ? "outlined" : "filled"}
                        />
                    ))}
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                        label={getMyWorkStatusLabel(row)}
                        color={getMyWorkStatusChipColor(row)}
                        size="small"
                    />
                    <Chip label={getRunScopeLabel(row.currentRun)} size="small" variant="outlined" />
                    <Chip label={getPendingLabel(row.currentRun)} size="small" variant="outlined" />
                </Stack>

                <Divider />

                <Stack spacing={0.75}>
                    <Typography variant="body2">
                        <strong>Pending With:</strong> {row.currentRun?.pendingApprover?.Title ?? "No current approver"}
                    </Typography>
                    <Typography variant="body2">
                        <strong>Last My Action:</strong> {getLatestActionSummary(row.latestMyAction)}
                    </Typography>
                    <Typography variant="body2">
                        <strong>Dates:</strong> Created {formatSinceDate(row.authorization.Created)}, Updated {formatSinceDate(row.authorization.Modified)}
                    </Typography>
                    <Typography variant="body2">
                        <strong>Entities:</strong> {formatRelationship(
                            row.authorization.donorEntityAbbr || row.authorization.donorEntity,
                            row.authorization.receivingEntityAbbr || row.authorization.receivingEntity
                        )}
                    </Typography>
                </Stack>

                {row.isDraft && canResumeDraft && (
                    <Stack spacing={1}>
                        <Button
                            variant="contained"
                            color="secondary"
                            onClick={() => onResumeDraft(row.authorization.Id)}
                            aria-label={resumeLabel}
                            title={resumeLabel}
                        >
                            {resumeLabel}
                        </Button>
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={() => onDiscardDraft(row)}
                            aria-label={discardLabel}
                            title={discardLabel}
                        >
                            {discardLabel}
                        </Button>
                    </Stack>
                )}
                {!row.isDraft && canEditActive && (
                    <Button
                        variant="contained"
                        color={row.currentRun?.runType === "mod" ? "secondary" : "primary"}
                        onClick={() => onEditActive(row)}
                        aria-label={editLabel}
                        title={editLabel}
                    >
                        {editLabel}
                    </Button>
                )}
                {canDeleteIwa && !row.isDraft && (
                    <Button
                        variant="outlined"
                        color="error"
                        onClick={() => onDeleteIwa(row)}
                        aria-label="Permanently delete this IWA"
                        title="Permanently delete this IWA"
                    >
                        Delete IWA
                    </Button>
                )}
                {canCancelModRequest && !row.isDraft && (
                    <Button
                        variant="outlined"
                        color="error"
                        onClick={() => onCancelMod(row)}
                        aria-label="Permanently Cancel this Mod request"
                        title="Permanently Cancel this Mod request"
                    >
                        Cancel Mod
                    </Button>
                )}
            </Stack>
        </Paper>
    );
};

export const MyWorkPage: React.FC = (): JSX.Element => {
    const theme = useTheme();
    const history = useHistory();
    const { view } = useParams<{ view?: string; }>();
    const isSmall = useMediaQuery(theme.breakpoints.down("md"));
    const {
        authorizations,
        draftAuthorizations,
        draftModsByAuthorizationId,
        appUsers,
        currentUser,
        isBootLoading,
        isMyActionsLoading,
        loadMyActions,
        myActions,
        refreshAppUsers,
        runByAuthorizationId,
        clearAuthorizationDetailCache,
        refresh
    } = useIwa();
    const { showBusy, hideBusy, showSnackbar } = useShellUi();
    const currentUserId = DataSource.CurrentUserId;

    const [searchText, setSearchText] = React.useState<string>("");
    const [discardDraftRow, setDiscardDraftRow] = React.useState<IMyWorkRow | undefined>(undefined);
    const [deleteIwaRow, setDeleteIwaRow] = React.useState<IMyWorkRow | undefined>(undefined);
    const [deleteError, setDeleteError] = React.useState<string>("");
    const [deleteBusy, setDeleteBusy] = React.useState<boolean>(false);
    const [cancelModRow, setCancelModRow] = React.useState<IMyWorkRow | undefined>(undefined);
    const [cancelModError, setCancelModError] = React.useState<string>("");
    const [cancelModBusy, setCancelModBusy] = React.useState<boolean>(false);
    const [modsById, setModsById] = React.useState<Map<number, IModItem>>(new Map());
    const selectedView = isPresetView(view) ? view : defaultPresetView;

    React.useEffect((): void => {
        if (!isPresetView(view)) {
            history.replace(`/my-work/${defaultPresetView}`);
        }
    }, [history, view]);

    React.useEffect((): void => {
        sessionStorage.setItem("iwa:lastReturnLocation", `/my-work/${selectedView}`);
    }, [selectedView]);

    React.useEffect((): void => {
        const userId = currentUserId;

        if (!userId || !consumeWorkflowListsStale()) {
            return;
        }

        refresh(true).catch((error: unknown) => {
            console.error("Error refreshing My Work after workflow action", error);
        });

        loadMyActions(userId, true).catch((error: unknown) => {
            console.error("Error refreshing My Work actions after workflow action", error);
        });
    }, [currentUserId, loadMyActions, refresh]);

    // My Work needs both the user's prior actions and the backup user graph.
    React.useEffect((): void => {
        const userId = currentUserId;

        if (!userId) {
            return;
        }

        loadMyActions(userId).catch((error: unknown) => {
            console.error("Error loading My Work actions", error);
        });

        refreshAppUsers().catch((error: unknown) => {
            console.error("Error loading app users for My Work", error);
        });
    }, [currentUserId, loadMyActions, refreshAppUsers]);

    React.useEffect((): (() => void) => {
        let isMounted = true;

        ModService.getAll()
            .then((mods) => {
                if (isMounted) {
                    setModsById(new Map(mods.map((mod) => [mod.Id, mod])));
                }
            })
            .catch((error: unknown) => {
                console.error("Error loading Mods for My Work edit access", error);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const myWorkSummary = React.useMemo(() => {
        return buildMyWorkSummary(
            authorizations,
            draftAuthorizations,
            runByAuthorizationId,
            draftModsByAuthorizationId,
            myActions,
            appUsers,
            currentUserId
        );
    }, [authorizations, draftAuthorizations, draftModsByAuthorizationId, appUsers, currentUserId, myActions, runByAuthorizationId]);

    const handleResumeDraft = React.useCallback((authorizationId: number): void => {
        const draftMod = draftModsByAuthorizationId.get(authorizationId);

        history.push(`/authorizations/edit/${authorizationId}`, {
            returnTo: `/my-work/${selectedView}`,
            modId: draftMod?.Id
        });
    }, [draftModsByAuthorizationId, history, selectedView]);

    const getEditableMod = React.useCallback((row: IMyWorkRow): IModItem | undefined => {
        const activeModId = row.currentRun?.runType === "mod" ? row.currentRun.mod?.Id : undefined;
        return row.draftMod ?? (activeModId ? modsById.get(activeModId) : undefined);
    }, [modsById]);

    const handleEditActive = React.useCallback((row: IMyWorkRow): void => {
        const mod = getEditableMod(row);
        history.push(`/authorizations/edit/${row.authorization.Id}`, {
            returnTo: `/my-work/${selectedView}`,
            modId: mod?.Id,
            mod
        });
    }, [getEditableMod, history, selectedView]);

    const canResumeDraft = React.useCallback((row: IMyWorkRow): boolean => {
        return row.isDraft && canUserEditAuthorization(row.authorization, currentUser, appUsers, row.draftMod);
    }, [appUsers, currentUser]);

    const canEditActive = React.useCallback((row: IMyWorkRow): boolean => {
        return !row.isDraft &&
            row.currentRun?.runStatus === "active" &&
            canUserEditAuthorization(row.authorization, currentUser, appUsers, getEditableMod(row));
    }, [appUsers, currentUser, getEditableMod]);

    const canDeleteIwa = React.useCallback((row: IMyWorkRow): boolean => {
        return canDeleteAuthorization(row.authorization, currentUser, appUsers, row.currentRun);
    }, [appUsers, currentUser]);

    const canCancelModRequest = React.useCallback((row: IMyWorkRow): boolean => {
        return canCancelMod(row.authorization, currentUser, appUsers, row.currentRun, row.currentRun?.mod);
    }, [appUsers, currentUser]);

    const handleDiscardDraft = React.useCallback(async (): Promise<void> => {
        if (!discardDraftRow) {
            return;
        }

        const authorizationId = discardDraftRow.authorization.Id;
        const authorizationTitle = discardDraftRow.authorization.Title || "IWA";

        try {
            flushSync(() => {
                setDiscardDraftRow(undefined);
                showBusy(discardDraftRow.isModDraft ? "Discarding modification draft..." : "Discarding draft...");
            });

            if (discardDraftRow.isModDraft && discardDraftRow.draftMod?.Id) {
                await ModService.discardDraft(authorizationId, discardDraftRow.draftMod.Id);
                await AuthorizationService.recalculateModCount(authorizationId);
                sessionStorage.removeItem(`iwa:activeModDraft:${authorizationId}`);
            } else {
                await AuthorizationService.delete(authorizationId);
            }

            clearAuthorizationDetailCache(authorizationId);
            await refresh(true);
            hideBusy();
            showSnackbar(
                discardDraftRow.isModDraft
                    ? `${authorizationTitle} modification draft discarded.`
                    : `${authorizationTitle} draft discarded.`,
                "success",
                deleteSuccessDurationMs
            );
        } catch (error) {
            hideBusy();
            showSnackbar(formatError(error), "error");
        }
    }, [clearAuthorizationDetailCache, discardDraftRow, hideBusy, refresh, showBusy, showSnackbar]);

    const handleDeleteIwa = React.useCallback(async (): Promise<void> => {
        if (!deleteIwaRow) {
            return;
        }

        const authorizationId = deleteIwaRow.authorization.Id;
        const authorizationTitle = deleteIwaRow.authorization.Title || "IWA";
        try {
            flushSync(() => {
                setDeleteBusy(true);
                setDeleteError("");
                setDeleteIwaRow(undefined);
                showBusy("Deleting IWA and associated data...");
            });
            await AuthorizationService.deleteAuthorizationCascade(authorizationId);
            clearAuthorizationDetailCache(authorizationId);
            await refresh(true);
            hideBusy();
            showSnackbar(`${authorizationTitle} deleted.`, "success", deleteSuccessDurationMs);
        } catch (error) {
            hideBusy();
            showSnackbar(formatError(error), "error");
        } finally {
            setDeleteBusy(false);
        }
    }, [clearAuthorizationDetailCache, deleteIwaRow, hideBusy, refresh, showBusy, showSnackbar]);

    const handleCancelMod = React.useCallback(async (): Promise<void> => {
        if (!cancelModRow?.currentRun?.mod?.Id) {
            return;
        }

        const authorizationId = cancelModRow.authorization.Id;
        const authorizationTitle = cancelModRow.authorization.Title || "IWA";
        const modNumber = cancelModRow.currentRun.mod.Title?.replace(/^.*MOD-/i, "") || "";
        try {
            flushSync(() => {
                setCancelModBusy(true);
                setCancelModError("");
                setCancelModRow(undefined);
                showBusy("Canceling Mod and reverting IWA...");
            });
            await AuthorizationService.cancelSubmittedMod(authorizationId, cancelModRow.currentRun.mod.Id);
            clearAuthorizationDetailCache(authorizationId);
            await refresh(true);
            hideBusy();
            showSnackbar(`${authorizationTitle} Mod ${modNumber} canceled and reverted to the previously approved state.`, "success", deleteSuccessDurationMs);
        } catch (error) {
            hideBusy();
            showSnackbar(formatError(error), "error");
        } finally {
            setCancelModBusy(false);
        }
    }, [cancelModRow, clearAuthorizationDetailCache, hideBusy, refresh, showBusy, showSnackbar]);

    const handleViewAuthorization = React.useCallback((authorizationId: number): void => {
        history.push(`/authorizations/view/${authorizationId}`);
    }, [history]);

    const handleSelectView = React.useCallback((value: MyWorkPresetView): void => {
        history.push(`/my-work/${value}`);
    }, [history]);

    const handleChangeView = React.useCallback((_event: React.SyntheticEvent, value: MyWorkPresetView): void => {
        handleSelectView(value);
    }, [handleSelectView]);

    const filteredRows = React.useMemo((): IMyWorkRow[] => {
        return filterMyWorkRows(myWorkSummary.rows, selectedView, searchText);
    }, [myWorkSummary.rows, searchText, selectedView]);

    const presetViewCounts = React.useMemo((): Record<MyWorkPresetView, number> => {
        return presetViews.reduce((counts, presetView) => {
            counts[presetView.value] = filterMyWorkRows(myWorkSummary.rows, presetView.value, "").length;
            return counts;
        }, {} as Record<MyWorkPresetView, number>);
    }, [myWorkSummary.rows]);

    const currentUserFirstName = getFirstNameFromDisplayName(currentUser?.user?.Title);
    const selectedPresetView = presetViews.find((presetView) => presetView.value === selectedView);
    const selectedViewLabel = selectedPresetView
        ? formatPresetViewLabel(selectedPresetView.label, presetViewCounts[selectedPresetView.value] ?? 0)
        : formatPresetViewLabel("All My Work", presetViewCounts.all ?? 0);

    return (
        <Stack spacing={3}>
            <PageHeader
                title={`Welcome Back${currentUserFirstName ? `, ${currentUserFirstName}` : ""}!`}
                subtitle="Here's a summary of IWA's you created, the workflow items waiting on you or your backup coverage, and the items you have already acted on."
            />

            <Box
                sx={{
                    display: "grid",
                    gap: { xs: 1, sm: 1.25, md: 1.5, lg: 2 },
                    gridTemplateColumns: {
                        xs: "repeat(2, minmax(0, 1fr))",
                        sm: "repeat(4, minmax(0, 1fr))"
                    }
                }}
            >
                <MyWorkSummaryCard
                    title="Needs My Action"
                    value={myWorkSummary.needsMyActionCount}
                    helperText="Active workflow items directly assigned to you."
                    icon={<AssignmentTurnedInOutlinedIcon />}
                    isSelected={selectedView === "needsAction"}
                    onClick={() => handleSelectView("needsAction")}
                />
                <MyWorkSummaryCard
                    title="Backup Coverage"
                    value={myWorkSummary.backupCoverageCount}
                    helperText="Items where you are covering for another approver."
                    icon={<ContentPasteGoOutlinedIcon />}
                    isSelected={selectedView === "backupCoverage"}
                    onClick={() => handleSelectView("backupCoverage")}
                />
                <MyWorkSummaryCard
                    title="Created By Me"
                    value={myWorkSummary.createdByMeCount}
                    helperText="Authorizations and drafts where you are the requestor/author."
                    icon={<EditNoteOutlinedIcon />}
                    isSelected={selectedView === "created"}
                    onClick={() => handleSelectView("created")}
                />
                <MyWorkSummaryCard
                    title="I Acted On"
                    value={myWorkSummary.actedOnByMeCount}
                    helperText="Authorizations where you have a workflow action history."
                    icon={<FactCheckOutlinedIcon />}
                    isSelected={selectedView === "activity"}
                    onClick={() => handleSelectView("activity")}
                />
            </Box>

            <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3 }}>
                <TextField
                    placeholder="Search title, contract, JAMIS project ID, entities, approver, or relationship..."
                    value={searchText}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>): void => setSearchText(event.target.value)}
                    fullWidth
                    slotProps={{
                        input: {
                            startAdornment: (
                                <Box sx={{ display: "flex", alignItems: "center", mr: 1, color: "text.secondary" }}>
                                    <SearchIcon fontSize="small" />
                                </Box>
                            )
                        }
                    }}
                />
            </Paper>

            <Paper sx={{ px: 1, borderRadius: 3 }}>
                <BottomNavigation
                    showLabels
                    value={selectedView}
                    onChange={handleChangeView}
                    sx={(theme) => ({
                        gap: 0.75,
                        px: 1,
                        py: 1,
                        height: "auto",
                        justifyContent: "flex-start",
                        alignItems: "stretch",
                        flexWrap: "wrap",
                        backgroundColor: "transparent",
                        "& .MuiBottomNavigationAction-root": {
                            flex: "0 0 auto",
                            minWidth: "auto",
                            width: "auto",
                            maxWidth: 220,
                            px: 2,
                            py: 1.25,
                            borderRadius: 2,
                            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                            color: theme.palette.text.secondary,
                            transition: "background-color 180ms ease, border-color 180ms ease, color 180ms ease",
                            "& .MuiBottomNavigationAction-label": {
                                fontSize: "0.82rem",
                                fontWeight: 500,
                                backgroundColor: "transparent",
                                opacity: 1
                            },
                            "& .MuiBottomNavigationAction-label.Mui-selected": {
                                fontSize: "0.82rem",
                                fontWeight: 600,
                                backgroundColor: "transparent"
                            }
                        },
                        "& .MuiBottomNavigationAction-root.Mui-selected": {
                            color: theme.palette.text.primary,
                            borderColor: theme.palette.mode === "dark"
                                ? theme.palette.primary.main
                                : theme.palette.primary.light ?? theme.palette.primary.main,
                            backgroundColor: theme.palette.mode === "dark"
                                ? "rgba(0,183,255,0.18)"
                                : "rgba(10,49,77,0.1)",
                            boxShadow: theme.palette.mode === "dark"
                                ? "inset 0 0 0 1px rgba(255,255,255,0.04)"
                                : "inset 0 0 0 1px rgba(255,255,255,0.35)"
                        }
                    })}
                >
                    {presetViews.map((view) => (
                        <BottomNavigationAction
                            key={view.value}
                            value={view.value}
                            label={formatPresetViewLabel(view.label, presetViewCounts[view.value] ?? 0)}
                        />
                    ))}
                </BottomNavigation>
            </Paper>

            <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3 }}>
                <Stack spacing={2}>
                    <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", md: "center" }}
                    >
                        <Box>
                            <Typography variant="h6" fontWeight={600}>
                                {selectedViewLabel}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {filteredRows.length} item{filteredRows.length === 1 ? "" : "s"} shown
                            </Typography>
                        </Box>
                    </Stack>

                    {(isBootLoading || isMyActionsLoading) && (
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 2 }}>
                            <CircularProgress size={22} />
                            <Typography color="text.secondary">
                                Building your work queue...
                            </Typography>
                        </Stack>
                    )}

                    {!isBootLoading && !isMyActionsLoading && filteredRows.length === 0 && (
                        <Box sx={{ py: 4 }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                                Nothing matches this view yet.
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Try a different preset view or clear the search to see more IWA activity.
                            </Typography>
                        </Box>
                    )}

                    {!isBootLoading && !isMyActionsLoading && filteredRows.length > 0 && (
                        <>
                            {isSmall ? (
                                <Stack spacing={1.5}>
                                    {filteredRows.map((row: IMyWorkRow): JSX.Element => (
                                        <MyWorkMobileCard
                                            key={row.authorization.Id}
                                            row={row}
                                            canResumeDraft={canResumeDraft(row)}
                                            canEditActive={canEditActive(row)}
                                            canDeleteIwa={!row.isDraft && canDeleteIwa(row)}
                                            canCancelModRequest={!row.isDraft && canCancelModRequest(row)}
                                            onResumeDraft={handleResumeDraft}
                                            onEditActive={handleEditActive}
                                            onDiscardDraft={setDiscardDraftRow}
                                            onDeleteIwa={setDeleteIwaRow}
                                            onCancelMod={setCancelModRow}
                                        />
                                    ))}
                                </Stack>
                            ) : (
                                <TableContainer>
                                    <Table size="small" sx={{ minWidth: 1260, tableLayout: "fixed" }}>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ width: 260 }}>Authorization</TableCell>
                                                <TableCell sx={{ width: 125 }}>Why It&apos;s Here</TableCell>
                                                <TableCell sx={{ width: 145 }}>Status</TableCell>
                                                <TableCell sx={{ width: 135 }}>Current Run / Mod</TableCell>
                                                <TableCell sx={{ width: 130 }}>Pending With</TableCell>
                                                <TableCell sx={{ width: 130 }}>My Last Action</TableCell>
                                                <TableCell sx={{ width: 170 }}>Key Dates</TableCell>
                                                <TableCell sx={{ width: 130 }}>Action</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {filteredRows.map((row: IMyWorkRow): JSX.Element => (
                                                <TableRow
                                                    key={row.authorization.Id}
                                                    hover
                                                    onDoubleClick={() => handleViewAuthorization(row.authorization.Id)}
                                                >
                                                    <TableCell sx={{ width: 260, verticalAlign: "top" }}>
                                                        <Stack spacing={0.5}>
                                                            <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                                                                <Link
                                                                    component={RouterLink}
                                                                    to={`/authorizations/view/${row.authorization.Id}`}
                                                                    fontWeight={600}
                                                                    underline="hover"
                                                                    color="primary"
                                                                    sx={{
                                                                        fontSize: "1rem",
                                                                        lineHeight: 1.3,
                                                                        overflowWrap: "anywhere"
                                                                    }}
                                                                >
                                                                    {row.authorization.Title}
                                                                </Link>
                                                                {hasModIndicator(row) && (
                                                                    <Tooltip title={`${row.authorization.modCount ?? 0} modification(s)`}>
                                                                        <Chip
                                                                            icon={<AccountTreeOutlinedIcon />}
                                                                            label={getModIndicatorLabel(row)}
                                                                            size="small"
                                                                            variant="outlined"
                                                                            sx={{ height: 22 }}
                                                                        />
                                                                    </Tooltip>
                                                                )}
                                                            </Stack>
                                                            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                                                                {row.authorization.contractName || "No contract title"}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                                                                {formatRelationship(
                                                                    row.authorization.donorEntityAbbr || row.authorization.donorEntity,
                                                                    row.authorization.receivingEntityAbbr || row.authorization.receivingEntity
                                                                )}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell sx={{ width: 125, verticalAlign: "top" }}>
                                                        <Stack direction="column" spacing={0.75} alignItems="flex-start">
                                                            {row.relationshipBadges.map((badge: string): JSX.Element => (
                                                                <Chip
                                                                    key={`${row.authorization.Id}-${badge}`}
                                                                    label={badge}
                                                                    color={badge.indexOf("Needs") === 0 ? "warning" : "info"}
                                                                    size="small"
                                                                    variant={badge.indexOf("Created") >= 0 ? "outlined" : "filled"}
                                                                    sx={{ maxWidth: "100%" }}
                                                                />
                                                            ))}
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell sx={{ width: 145, verticalAlign: "top" }}>
                                                        <Stack spacing={0.75}>
                                                            <Chip
                                                                label={getMyWorkStatusLabel(row)}
                                                                color={getMyWorkStatusChipColor(row)}
                                                                size="small"
                                                                sx={{ width: "fit-content" }}
                                                            />
                                                            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                                                                {row.authorization.og || "No OG"} | {row.authorization.lob || "No LOB"}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell sx={{ width: 135, verticalAlign: "top" }}>
                                                        <Stack spacing={0.5}>
                                                            <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
                                                                {getRunScopeLabel(row.currentRun)}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {row.isModDraft ? `Mod ${row.draftMod?.modNumber ?? ""} not yet submitted` : row.isDraft ? "Draft not yet submitted" : row.currentRun?.runStatus === "active" ? "Active workflow" : "No active workflow"}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell sx={{ width: 130, verticalAlign: "top" }}>
                                                        <Stack spacing={0.5}>
                                                            <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                                                                {row.isDraft ? "Waiting for you" : row.currentRun?.pendingApprover?.Title ?? "No current approver"}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {row.isModDraft ? "Resume mod" : row.isDraft ? "Resume draft" : getPendingLabel(row.currentRun)}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell sx={{ width: 130, verticalAlign: "top" }}>
                                                        <Stack spacing={0.5}>
                                                            <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                                                                {row.isDraft ? "Not submitted yet" : getLatestActionSummary(row.latestMyAction)}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {!row.isDraft && row.latestMyAction?.actionDate
                                                                    ? `${formatSinceDate(row.latestMyAction.actionDate)} (${row.myActionCount} total)`
                                                                    : row.isDraft ? "No workflow actions yet" : "No workflow actions by you"}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell sx={{ width: 170, verticalAlign: "top" }}>
                                                        <Stack spacing={0.5}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                Created: {formatDate(row.authorization.Created, true)}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                Updated: {formatDate(row.authorization.Modified, true)}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                Assigned: {row.currentRun?.stepAssignedDate ? formatDate(row.currentRun.stepAssignedDate, true) : "—"}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell sx={{ width: 120, verticalAlign: "top" }}>
                                                        {canResumeDraft(row) || canEditActive(row) || (!row.isDraft && (canDeleteIwa(row) || canCancelModRequest(row))) ? (
                                                            <Stack spacing={1} alignItems="flex-start">
                                                                {canResumeDraft(row) && (
                                                                    <>
                                                                        <Button
                                                                            variant="contained"
                                                                            color="secondary"
                                                                            size="small"
                                                                            onClick={() => handleResumeDraft(row.authorization.Id)}
                                                                            aria-label={row.isModDraft ? "Resume Mod" : "Resume Draft"}
                                                                            title={row.isModDraft ? "Resume Mod" : "Resume Draft"}
                                                                        >
                                                                            {row.isModDraft ? "Resume Mod" : "Resume Draft"}
                                                                        </Button>
                                                                        <Button
                                                                            variant="outlined"
                                                                            color="error"
                                                                            size="small"
                                                                            onClick={() => setDiscardDraftRow(row)}
                                                                            aria-label={row.isModDraft ? "Discard Mod" : "Discard Draft"}
                                                                            title={row.isModDraft ? "Discard Mod" : "Discard Draft"}
                                                                        >
                                                                            {row.isModDraft ? "Discard Mod" : "Discard Draft"}
                                                                        </Button>
                                                                    </>
                                                                )}
                                                                {!row.isDraft && canEditActive(row) && (
                                                                    <Button
                                                                        variant="contained"
                                                                        color={row.currentRun?.runType === "mod" ? "secondary" : "primary"}
                                                                        size="small"
                                                                        onClick={() => handleEditActive(row)}
                                                                        aria-label={row.currentRun?.runType === "mod" ? "Edit Mod" : "Edit IWA"}
                                                                        title={row.currentRun?.runType === "mod" ? "Edit Mod" : "Edit IWA"}
                                                                    >
                                                                        {row.currentRun?.runType === "mod" ? "Edit Mod" : "Edit IWA"}
                                                                    </Button>
                                                                )}
                                                                {!row.isDraft && canDeleteIwa(row) && (
                                                                    <Button
                                                                        variant="outlined"
                                                                        color="error"
                                                                        size="small"
                                                                        onClick={() => setDeleteIwaRow(row)}
                                                                        aria-label="Permanently delete this IWA"
                                                                        title="Permanently delete this IWA"
                                                                    >
                                                                        Delete IWA
                                                                    </Button>
                                                                )}
                                                                {!row.isDraft && canCancelModRequest(row) && (
                                                                    <Button
                                                                        variant="outlined"
                                                                        color="error"
                                                                        size="small"
                                                                        onClick={() => setCancelModRow(row)}
                                                                        aria-label="Permanently Cancel this Mod request"
                                                                        title="Permanently Cancel this Mod request"
                                                                    >
                                                                        Cancel Mod
                                                                    </Button>
                                                                )}
                                                            </Stack>
                                                        ) : (
                                                            <Typography variant="caption" color="text.secondary">
                                                                —
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </>
                    )}
                </Stack>
            </Paper>

            <Dialog open={!!discardDraftRow} onClose={() => setDiscardDraftRow(undefined)} fullWidth maxWidth="sm">
                <DialogTitle>{discardDraftRow?.isModDraft ? "Discard Mod?" : "Discard Draft?"}</DialogTitle>
                <DialogContent>
                    <Typography color="text.secondary">
                        {discardDraftRow?.isModDraft
                            ? `This will permanently discard Mod ${discardDraftRow.draftMod?.modNumber ?? ""} and remove linked mod resources, labor, and travel.`
                            : `This will permanently discard ${discardDraftRow?.authorization.Title ?? "this draft authorization"} and remove it from your draft list.`}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDiscardDraftRow(undefined)} aria-label="Cancel discard draft" title="Cancel discard draft">Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        startIcon={<DeleteOutlineOutlinedIcon />}
                        onClick={() => handleDiscardDraft()}
                        aria-label={discardDraftRow?.isModDraft ? "Discard Mod" : "Discard Draft"}
                        title={discardDraftRow?.isModDraft ? "Discard Mod" : "Discard Draft"}
                    >
                        {discardDraftRow?.isModDraft ? "Discard Mod" : "Discard Draft"}
                    </Button>
                </DialogActions>
            </Dialog>
            <ConfirmDeleteDialog
                open={!!deleteIwaRow}
                title="Delete IWA"
                message="Are you sure you want to permanently delete this request and all associated data?"
                confirmLabel="Delete IWA"
                error={deleteError}
                busy={deleteBusy}
                onClose={() => {
                    if (!deleteBusy) {
                        setDeleteIwaRow(undefined);
                        setDeleteError("");
                    }
                }}
                onConfirm={handleDeleteIwa}
            />
            <ConfirmDeleteDialog
                open={!!cancelModRow}
                title="Cancel Mod"
                message={"Do you want to permanently cancel this Mod request and all associated Mod data? This IWA will be reverted back to its previously approved state.\n\nThis action cannot be undone."}
                confirmLabel="Yes, Cancel Mod"
                cancelLabel="No, Go Back"
                error={cancelModError}
                busy={cancelModBusy}
                onClose={() => {
                    if (!cancelModBusy) {
                        setCancelModRow(undefined);
                        setCancelModError("");
                    }
                }}
                onConfirm={handleCancelMod}
            />
        </Stack>
    );
};
