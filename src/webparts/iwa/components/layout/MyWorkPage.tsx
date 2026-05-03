import * as React from "react";
import {
    Box, BottomNavigation, BottomNavigationAction, Button, Chip, CircularProgress, Divider, Dialog, DialogActions,
    DialogContent, DialogTitle, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
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
import { formatDate, formatError, formatRelationship, formatSinceDate } from "../common/utils";
import { PageHeader } from "../ui/PageHeader";
import { useHistory, useParams } from "react-router-dom";
import { AuthorizationService } from "../authorizations/iwaService";
import { ModService } from "../mods/modService";
import { useShellUi } from "../ui/ShellUiContext";
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

interface IMyWorkSummaryCardProps {
    title: string;
    value: number;
    helperText: string;
    icon: React.ReactNode;
}

const MyWorkSummaryCard: React.FC<IMyWorkSummaryCardProps> = ({
    title,
    value,
    helperText,
    icon
}): JSX.Element => {
    const theme = useTheme();
    const isCompact = useMediaQuery(theme.breakpoints.down("lg"));
    const hideHelperText = useMediaQuery(theme.breakpoints.down("md"));

    return (
        <Paper
            sx={{
                p: { xs: 1.25, sm: 1.5, md: 1.75 },
                borderRadius: 3,
                height: "100%"
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
                                <IconButton
                                    size="small"
                                    sx={{
                                        color: "text.secondary",
                                        p: 0.25
                                    }}
                                >
                                    <InfoOutlinedIcon fontSize="inherit" />
                                </IconButton>
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
    { value: "all", label: "All My Work" },
    { value: "needsAction", label: "Needs My Action" },
    { value: "created", label: "Created By Me" },
    { value: "activity", label: "My Activity" },
    { value: "activeWorkflow", label: "Active Workflow" },
    { value: "closed", label: "Recently Closed" }
];

const defaultPresetView: MyWorkPresetView = "all";

const isPresetView = (value: string | undefined): value is MyWorkPresetView => {
    return presetViews.some((view) => view.value === value);
};

const hasModIndicator = (row: IMyWorkRow): boolean => {
    return row.isModDraft || row.currentRun?.runType === "mod" || (row.authorization.modCount ?? 0) > 0;
};

const getModIndicatorLabel = (row: IMyWorkRow): string => {
    if (row.isModDraft && row.draftMod?.modNumber) {
        return `M${row.draftMod.modNumber}`;
    }

    if (row.currentRun?.runType === "mod" && row.currentRun.mod?.Title) {
        return row.currentRun.mod.Title.replace(/^.*MOD-/i, "M");
    }

    return `M${row.authorization.modCount ?? 0}`;
};

const getMyWorkStatusLabel = (row: IMyWorkRow): string => {
    if (row.isModDraft) {
        return "Mod Draft";
    }

    if (row.currentRun?.runType === "mod") {
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
    onResumeDraft: (id: number) => void;
    onDiscardDraft: (row: IMyWorkRow) => void;
}> = ({ row, onResumeDraft, onDiscardDraft }): JSX.Element => {
    const resumeLabel = row.isModDraft ? "Resume Mod" : "Resume Draft";
    const discardLabel = row.isModDraft ? "Discard Mod" : "Discard Draft";

    return (
        <Paper sx={{ p: 2.25, borderRadius: 3 }}>
            <Stack spacing={1.5}>
                <Stack spacing={0.5}>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="h6" fontWeight={600}>
                            {row.authorization.Title}
                        </Typography>
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

                {row.isDraft && (
                    <Stack spacing={1}>
                        <Button
                            variant="contained"
                            color="secondary"
                            onClick={() => onResumeDraft(row.authorization.Id)}
                        >
                            {resumeLabel}
                        </Button>
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={() => onDiscardDraft(row)}
                        >
                            {discardLabel}
                        </Button>
                    </Stack>
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
    const { showBusy, hideBusy, showSuccess, showSnackbar } = useShellUi();

    const [searchText, setSearchText] = React.useState<string>("");
    const [discardDraftRow, setDiscardDraftRow] = React.useState<IMyWorkRow | undefined>(undefined);
    const selectedView = isPresetView(view) ? view : defaultPresetView;

    React.useEffect((): void => {
        if (!isPresetView(view)) {
            history.replace(`/my-work/${defaultPresetView}`);
        }
    }, [history, view]);

    React.useEffect((): void => {
        sessionStorage.setItem("iwa:lastReturnLocation", `/my-work/${selectedView}`);
    }, [selectedView]);

    // My Work needs both the user's prior actions and the backup user graph.
    React.useEffect((): void => {
        const userId = currentUser?.user?.Id;

        if (!userId) {
            return;
        }

        loadMyActions(userId).catch((error: unknown) => {
            console.error("Error loading My Work actions", error);
        });

        refreshAppUsers().catch((error: unknown) => {
            console.error("Error loading app users for My Work", error);
        });
    }, [currentUser?.user?.Id, loadMyActions, refreshAppUsers]);

    const myWorkSummary = React.useMemo(() => {
        return buildMyWorkSummary(
            authorizations,
            draftAuthorizations,
            runByAuthorizationId,
            draftModsByAuthorizationId,
            myActions,
            appUsers,
            currentUser?.user?.Id
        );
    }, [authorizations, draftAuthorizations, draftModsByAuthorizationId, appUsers, currentUser?.user?.Id, myActions, runByAuthorizationId]);

    const handleResumeDraft = React.useCallback((authorizationId: number): void => {
        history.push(`/authorizations/edit/${authorizationId}`, {
            returnTo: `/my-work/${selectedView}`
        });
    }, [history, selectedView]);

    const handleDiscardDraft = React.useCallback(async (): Promise<void> => {
        if (!discardDraftRow) {
            return;
        }

        const authorizationId = discardDraftRow.authorization.Id;
        setDiscardDraftRow(undefined);

        try {
            showBusy(discardDraftRow.isModDraft ? "Discarding modification draft..." : "Discarding draft...");

            if (discardDraftRow.isModDraft && discardDraftRow.draftMod?.Id) {
                await ModService.discardDraft(authorizationId, discardDraftRow.draftMod.Id);
                await AuthorizationService.updateModCount(authorizationId, Math.max(0, (discardDraftRow.authorization.modCount ?? 1) - 1));
                sessionStorage.removeItem(`iwa:activeModDraft:${authorizationId}`);
            } else {
                await AuthorizationService.delete(authorizationId);
            }

            clearAuthorizationDetailCache(authorizationId);
            await refresh(true);
            hideBusy();
            showSuccess(discardDraftRow.isModDraft ? "Modification draft discarded." : "Draft discarded.");
        } catch (error) {
            hideBusy();
            showSnackbar(formatError(error), "error");
        }
    }, [clearAuthorizationDetailCache, discardDraftRow, hideBusy, refresh, showBusy, showSnackbar, showSuccess]);

    const handleViewAuthorization = React.useCallback((authorizationId: number): void => {
        history.push(`/authorizations/view/${authorizationId}`);
    }, [history]);

    const handleChangeView = React.useCallback((_event: React.SyntheticEvent, value: MyWorkPresetView): void => {
        history.push(`/my-work/${value}`);
    }, [history]);

    const filteredRows = React.useMemo((): IMyWorkRow[] => {
        return filterMyWorkRows(myWorkSummary.rows, selectedView, searchText);
    }, [myWorkSummary.rows, searchText, selectedView]);

    const selectedViewLabel = presetViews.find((view) => view.value === selectedView)?.label ?? "All My Work";

    return (
        <Stack spacing={3}>
            <PageHeader
                title="My Work"
                subtitle="Track the IWAs you created, the workflow items waiting on you or your backup coverage, and the items you have already acted on."
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
                />
                <MyWorkSummaryCard
                    title="Backup Coverage"
                    value={myWorkSummary.backupCoverageCount}
                    helperText="Items where you are covering for another approver."
                    icon={<ContentPasteGoOutlinedIcon />}
                />
                <MyWorkSummaryCard
                    title="Created By Me"
                    value={myWorkSummary.createdByMeCount}
                    helperText="Authorizations and drafts where you are the requestor/author."
                    icon={<EditNoteOutlinedIcon />}
                />
                <MyWorkSummaryCard
                    title="I Acted On"
                    value={myWorkSummary.actedOnByMeCount}
                    helperText="Authorizations where you have a workflow action history."
                    icon={<FactCheckOutlinedIcon />}
                />
            </Box>

            <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3 }}>
                <TextField
                    placeholder="Search title, contract, entities, approver, or relationship..."
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
                        <BottomNavigationAction key={view.value} value={view.value} label={view.label} />
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
                                            onResumeDraft={handleResumeDraft}
                                            onDiscardDraft={setDiscardDraftRow}
                                        />
                                    ))}
                                </Stack>
                            ) : (
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Authorization</TableCell>
                                                <TableCell>Why It&apos;s Here</TableCell>
                                                <TableCell>Status</TableCell>
                                                <TableCell>Current Run / Mod</TableCell>
                                                <TableCell>Pending With</TableCell>
                                                <TableCell>My Last Action</TableCell>
                                                <TableCell>Key Dates</TableCell>
                                                <TableCell>Action</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {filteredRows.map((row: IMyWorkRow): JSX.Element => (
                                                <TableRow
                                                    key={row.authorization.Id}
                                                    hover
                                                    onDoubleClick={() => handleViewAuthorization(row.authorization.Id)}
                                                    sx={{ cursor: "pointer" }}
                                                >
                                                    <TableCell sx={{ minWidth: 260, verticalAlign: "top" }}>
                                                        <Stack spacing={0.5}>
                                                            <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                                                                <Typography fontWeight={600}>
                                                                    {row.authorization.Title}
                                                                </Typography>
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
                                                                {row.authorization.contractName || "No contract title"}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {formatRelationship(
                                                                    row.authorization.donorEntityAbbr || row.authorization.donorEntity,
                                                                    row.authorization.receivingEntityAbbr || row.authorization.receivingEntity
                                                                )}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell sx={{ minWidth: 250, verticalAlign: "top" }}>
                                                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
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
                                                    </TableCell>
                                                    <TableCell sx={{ minWidth: 140, verticalAlign: "top" }}>
                                                        <Stack spacing={0.75}>
                                                            <Chip
                                                                label={getMyWorkStatusLabel(row)}
                                                                color={getMyWorkStatusChipColor(row)}
                                                                size="small"
                                                                sx={{ width: "fit-content" }}
                                                            />
                                                            <Typography variant="caption" color="text.secondary">
                                                                {row.authorization.og || "No OG"} | {row.authorization.lob || "No LOB"}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell sx={{ minWidth: 150, verticalAlign: "top" }}>
                                                        <Stack spacing={0.5}>
                                                            <Typography variant="body2" fontWeight={600}>
                                                                {getRunScopeLabel(row.currentRun)}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {row.isModDraft ? `Mod ${row.draftMod?.modNumber ?? ""} not yet submitted` : row.isDraft ? "Draft not yet submitted" : row.currentRun?.runStatus === "active" ? "Active workflow" : "No active workflow"}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell sx={{ minWidth: 180, verticalAlign: "top" }}>
                                                        <Stack spacing={0.5}>
                                                            <Typography variant="body2">
                                                                {row.isDraft ? "Waiting for you" : row.currentRun?.pendingApprover?.Title ?? "No current approver"}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {row.isModDraft ? "Resume mod" : row.isDraft ? "Resume draft" : getPendingLabel(row.currentRun)}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell sx={{ minWidth: 190, verticalAlign: "top" }}>
                                                        <Stack spacing={0.5}>
                                                            <Typography variant="body2">
                                                                {row.isDraft ? "Not submitted yet" : getLatestActionSummary(row.latestMyAction)}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {!row.isDraft && row.latestMyAction?.actionDate
                                                                    ? `${formatSinceDate(row.latestMyAction.actionDate)} (${row.myActionCount} total)`
                                                                    : row.isDraft ? "No workflow actions yet" : "No workflow actions by you"}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell sx={{ minWidth: 180, verticalAlign: "top" }}>
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
                                                    <TableCell sx={{ minWidth: 140, verticalAlign: "top" }}>
                                                        {row.isDraft ? (
                                                            <Stack spacing={1} alignItems="flex-start">
                                                                <Button
                                                                    variant="contained"
                                                                    color="secondary"
                                                                    size="small"
                                                                    onClick={() => handleResumeDraft(row.authorization.Id)}
                                                                >
                                                                    {row.isModDraft ? "Resume Mod" : "Resume Draft"}
                                                                </Button>
                                                                <Button
                                                                    variant="outlined"
                                                                    color="error"
                                                                    size="small"
                                                                    onClick={() => setDiscardDraftRow(row)}
                                                                >
                                                                    {row.isModDraft ? "Discard Mod" : "Discard Draft"}
                                                                </Button>
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
                    <Button onClick={() => setDiscardDraftRow(undefined)}>Cancel</Button>
                    <Button variant="contained" color="error" startIcon={<DeleteOutlineOutlinedIcon />} onClick={() => handleDiscardDraft()}>
                        {discardDraftRow?.isModDraft ? "Discard Mod" : "Discard Draft"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
};
