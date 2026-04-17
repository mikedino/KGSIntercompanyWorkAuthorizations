import * as React from "react";
import {
    Box,
    Chip,
    CircularProgress,
    Divider,
    IconButton,
    Paper,
    Stack,
    Tab,
    Tabs,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import ContentPasteGoOutlinedIcon from "@mui/icons-material/ContentPasteGoOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { useIwa } from "../data/iwaContext";
import { formatDate, formatSinceDate } from "../common/utils";
import { PageHeader } from "../ui/PageHeader";
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
                            minHeight: isCompact ? 34 : 40
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

const MyWorkMobileCard: React.FC<{ row: IMyWorkRow; }> = ({ row }): JSX.Element => {
    const currentStatusLabel = `Authorization ${authorizationStatusLabels[row.authorization.authorizationStatus]}`;

    return (
        <Paper sx={{ p: 2.25, borderRadius: 3 }}>
            <Stack spacing={1.5}>
                <Stack spacing={0.5}>
                    <Typography variant="h6" fontWeight={600}>
                        {row.authorization.Title}
                    </Typography>
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
                        label={currentStatusLabel}
                        color={getStatusChipColor(row.authorization.authorizationStatus)}
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
                        <strong>Entities:</strong> {row.authorization.donorEntity} {"->"} {row.authorization.receivingEntity}
                    </Typography>
                </Stack>
            </Stack>
        </Paper>
    );
};

export const MyWorkPage: React.FC = (): JSX.Element => {
    const theme = useTheme();
    const isSmall = useMediaQuery(theme.breakpoints.down("md"));
    const {
        authorizations,
        appUsers,
        currentUser,
        isBootLoading,
        isMyActionsLoading,
        loadMyActions,
        myActions,
        refreshAppUsers,
        runByAuthorizationId
    } = useIwa();

    const [selectedView, setSelectedView] = React.useState<MyWorkPresetView>("needsAction");
    const [searchText, setSearchText] = React.useState<string>("");

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
            runByAuthorizationId,
            myActions,
            appUsers,
            currentUser?.user?.Id
        );
    }, [authorizations, appUsers, currentUser?.user?.Id, myActions, runByAuthorizationId]);

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
                    helperText="Authorizations where you are the requestor/author."
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
                <Stack spacing={2}>
                    <Tabs
                        value={selectedView}
                        onChange={(_event: React.SyntheticEvent, value: MyWorkPresetView): void => setSelectedView(value)}
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                        sx={{
                            minHeight: 0,
                            // Scrollable tabs keep disabled scroll buttons in the layout,
                            // which looks like left padding before the first tab. Collapse
                            // those placeholders so the tab list aligns flush with the paper.
                            "& .MuiTabs-scrollButtons.Mui-disabled": {
                                width: 0,
                                opacity: 0,
                                overflow: "hidden"
                            },
                            "& .MuiTabs-scroller": {
                                marginLeft: "0 !important"
                            },
                            "& .MuiTab-root": {
                                minHeight: 40,
                                minWidth: 0,
                                textTransform: "none",
                                fontWeight: 600,
                                alignItems: "flex-start",
                                px: 1.5
                            }
                        }}
                    >
                        {presetViews.map((view) => (
                            <Tab key={view.value} value={view.value} label={view.label} />
                        ))}
                    </Tabs>

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
                </Stack>
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
                                        <MyWorkMobileCard key={row.authorization.Id} row={row} />
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
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {filteredRows.map((row: IMyWorkRow): JSX.Element => (
                                                <TableRow key={row.authorization.Id} hover>
                                                    <TableCell sx={{ minWidth: 260, verticalAlign: "top" }}>
                                                        <Stack spacing={0.5}>
                                                            <Typography fontWeight={600}>
                                                                {row.authorization.Title}
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {row.authorization.contractName || "No contract title"}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {row.authorization.contractId || "No contract id"} | {row.authorization.invoice || "No invoice"}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {row.authorization.donorEntity} {"->"} {row.authorization.receivingEntity}
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
                                                                label={`Authorization ${authorizationStatusLabels[row.authorization.authorizationStatus]}`}
                                                                color={getStatusChipColor(row.authorization.authorizationStatus)}
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
                                                                {row.currentRun?.runStatus === "active" ? "Active workflow" : "No active workflow"}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell sx={{ minWidth: 180, verticalAlign: "top" }}>
                                                        <Stack spacing={0.5}>
                                                            <Typography variant="body2">
                                                                {row.currentRun?.pendingApprover?.Title ?? "No current approver"}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {getPendingLabel(row.currentRun)}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell sx={{ minWidth: 190, verticalAlign: "top" }}>
                                                        <Stack spacing={0.5}>
                                                            <Typography variant="body2">
                                                                {getLatestActionSummary(row.latestMyAction)}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {row.latestMyAction?.actionDate
                                                                    ? `${formatSinceDate(row.latestMyAction.actionDate)} (${row.myActionCount} total)`
                                                                    : "No workflow actions by you"}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell sx={{ minWidth: 180, verticalAlign: "top" }}>
                                                        <Stack spacing={0.5}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                Created: {formatDate(row.authorization.Created)}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                Updated: {formatDate(row.authorization.Modified)}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                Assigned: {row.currentRun?.stepAssignedDate ? formatDate(row.currentRun.stepAssignedDate) : "—"}
                                                            </Typography>
                                                        </Stack>
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
        </Stack>
    );
};
