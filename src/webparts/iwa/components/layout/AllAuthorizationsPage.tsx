import * as React from "react";
import {
    Box,
    BottomNavigation,
    BottomNavigationAction,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Menu,
    MenuItem,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TableSortLabel,
    TextField,
    Tooltip,
    Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import FilterAltOffOutlinedIcon from "@mui/icons-material/FilterAltOffOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import SearchIcon from "@mui/icons-material/Search";
import OpenInBrowserOutlinedIcon from "@mui/icons-material/OpenInBrowserOutlined";
import AlertDialog from "../ui/Alert";
import { PageHeader } from "../ui/PageHeader";
import { formatCurrency, formatDate, formatError, formatRelationship, formatSinceDate } from "../common/utils";
import { useIwa } from "../data/iwaContext";
import { workflowRoleLabels } from "../data/props";
import { useHistory, useParams } from "react-router-dom";
import { AuthorizationService } from "../authorizations/iwaService";
import { ModService } from "../mods/modService";
import { useShellUi } from "../ui/ShellUiContext";
import {
    AllAuthorizationsPresetView,
    AllAuthorizationsSortField,
    buildAllAuthorizationRows,
    exportAllAuthorizationRows,
    filterAllAuthorizationRows,
    getStatusChipColor,
    getUniqueFilterValues,
    getWorkflowStatusChipColor,
    IAllAuthorizationsFilters,
    IAllAuthorizationsRow,
    sortAllAuthorizationRows,
    workflowRunStatusLabels,
    authorizationStatusLabels
} from "./allAuthorizationsUtils";
import { formatModLabel } from "../authorizations/view/iwaViewUtils";

type ColumnKey =
    | "title"
    | "authorizationStatus"
    | "workflowStatus"
    | "pendingRole"
    | "assignedDate"
    | "baseGrandTotal"
    | "approvedGrandTotal"
    | "modCount"
    | "actions";

interface IColumnConfig {
    key: ColumnKey;
    label: string;
    sortField?: AllAuthorizationsSortField;
    minWidth: number;
    defaultWidth: number;
    align?: "left" | "right" | "center";
}

const presetViews: Array<{ value: AllAuthorizationsPresetView; label: string; }> = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "expiringSoon", label: "Expiring Soon" },
    { value: "expiredOrClosed", label: "Expired / Closed" },
    { value: "rejected", label: "Rejected" },
    { value: "withMods", label: "With Mods" }
];

const defaultPresetView: AllAuthorizationsPresetView = "all";

const isPresetView = (value: string | undefined): value is AllAuthorizationsPresetView => {
    return presetViews.some((view) => view.value === value);
};

const columnConfigs: IColumnConfig[] = [
    { key: "title", label: "Authorization", sortField: "title", minWidth: 280, defaultWidth: 320 },
    { key: "authorizationStatus", label: "Status", sortField: "authorizationStatus", minWidth: 120, defaultWidth: 140 },
    { key: "workflowStatus", label: "WF Status", sortField: "workflowStatus", minWidth: 150, defaultWidth: 170 },
    { key: "pendingRole", label: "WF Pending Role", sortField: "pendingRole", minWidth: 180, defaultWidth: 190 },
    { key: "assignedDate", label: "Assigned Date", sortField: "assignedDate", minWidth: 150, defaultWidth: 160 },
    { key: "baseGrandTotal", label: "Base Total", sortField: "baseGrandTotal", minWidth: 150, defaultWidth: 160, align: "right" },
    { key: "approvedGrandTotal", label: "Approved Total", sortField: "approvedGrandTotal", minWidth: 160, defaultWidth: 170, align: "right" },
    { key: "modCount", label: "Mods", sortField: "modCount", minWidth: 100, defaultWidth: 110, align: "center" },
    { key: "actions", label: "", minWidth: 72, defaultWidth: 72, align: "center" }
];

const defaultColumnWidths = columnConfigs.reduce((accumulator: Record<ColumnKey, number>, column: IColumnConfig) => {
    accumulator[column.key] = column.defaultWidth;
    return accumulator;
}, {} as Record<ColumnKey, number>);

const defaultFilters: IAllAuthorizationsFilters = {
    searchText: "",
    entity: "",
    og: "",
    lob: ""
};

const getPresetSummary = (presetView: AllAuthorizationsPresetView): string => {
    switch (presetView) {
        case "active":
            return "Submitted authorizations, items under review, or anything with an active workflow run.";
        case "expiringSoon":
            return "Authorizations whose period end date is within the next 30 days.";
        case "expiredOrClosed":
            return "Closed/canceled authorizations plus items whose performance period has already ended.";
        case "rejected":
            return "Authorizations or workflow runs that ended in rejection.";
        case "withMods":
            return "Authorizations that already have one or more modifications.";
        case "all":
        default:
            return "Every authorization currently available in the app.";
    }
};

const canEditAuthorization = (row: IAllAuthorizationsRow | undefined): boolean => {
    if (!row) {
        return false;
    }

    if (row.authorization.authorizationStatus === "draft" || row.isModDraft) {
        return true;
    }

    return row.currentRun?.runStatus === "active" && !row.currentRun?.hasDecision;
};

export const AllAuthorizationsPage: React.FC = (): JSX.Element => {
    const history = useHistory();
    const { view } = useParams<{ view?: string; }>();
    const {
        authorizations,
        draftAuthorizations,
        draftModsByAuthorizationId,
        isBootLoading,
        runByAuthorizationId,
        clearAuthorizationDetailCache,
        refresh
    } = useIwa();
    const { showBusy, hideBusy, showSuccess } = useShellUi();

    const [filters, setFilters] = React.useState<IAllAuthorizationsFilters>(defaultFilters);
    const [sortField, setSortField] = React.useState<AllAuthorizationsSortField>("modified");
    const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc");
    const [page, setPage] = React.useState<number>(0);
    const [pageSize, setPageSize] = React.useState<number>(25);
    const [columnWidths, setColumnWidths] = React.useState<Record<ColumnKey, number>>(defaultColumnWidths);
    const [menuAnchorEl, setMenuAnchorEl] = React.useState<HTMLElement | null>(null);
    const [menuRowId, setMenuRowId] = React.useState<number | undefined>(undefined);
    const [dialogTitle, setDialogTitle] = React.useState<string>("");
    const [dialogMessage, setDialogMessage] = React.useState<string>("");
    const [showDialog, setShowDialog] = React.useState<boolean>(false);
    const [discardDraftRow, setDiscardDraftRow] = React.useState<IAllAuthorizationsRow | undefined>(undefined);
    const selectedView = isPresetView(view) ? view : defaultPresetView;

    React.useEffect((): void => {
        if (!isPresetView(view)) {
            history.replace(`/all-authorizations/${defaultPresetView}`);
        }
    }, [history, view]);

    React.useEffect((): void => {
        sessionStorage.setItem("iwa:lastReturnLocation", `/all-authorizations/${selectedView}`);
    }, [selectedView]);

    const resizeStateRef = React.useRef<{
        columnKey: ColumnKey;
        startX: number;
        startWidth: number;
    } | null>(null);

    const allRows = React.useMemo((): IAllAuthorizationsRow[] => {
        return buildAllAuthorizationRows([...draftAuthorizations, ...authorizations], runByAuthorizationId, draftModsByAuthorizationId);
    }, [authorizations, draftAuthorizations, draftModsByAuthorizationId, runByAuthorizationId]);

    const entityOptions = React.useMemo((): string[] => {
        return getUniqueFilterValues(allRows, (row: IAllAuthorizationsRow): Array<string | undefined> => [
            row.authorization.donorEntity,
            row.authorization.receivingEntity
        ]);
    }, [allRows]);

    const ogOptions = React.useMemo((): string[] => {
        return getUniqueFilterValues(allRows, (row: IAllAuthorizationsRow): Array<string | undefined> => [row.authorization.og]);
    }, [allRows]);

    const lobOptions = React.useMemo((): string[] => {
        return getUniqueFilterValues(allRows, (row: IAllAuthorizationsRow): Array<string | undefined> => [row.authorization.lob]);
    }, [allRows]);

    const filteredRows = React.useMemo((): IAllAuthorizationsRow[] => {
        return filterAllAuthorizationRows(allRows, selectedView, filters);
    }, [allRows, filters, selectedView]);

    const sortedRows = React.useMemo((): IAllAuthorizationsRow[] => {
        return sortAllAuthorizationRows(filteredRows, sortField, sortDirection);
    }, [filteredRows, sortDirection, sortField]);

    const pagedRows = React.useMemo((): IAllAuthorizationsRow[] => {
        const start = page * pageSize;
        return sortedRows.slice(start, start + pageSize);
    }, [page, pageSize, sortedRows]);

    React.useEffect((): void => {
        setPage(0);
    }, [filters, selectedView]);

    React.useEffect((): (() => void) => {
        const handleMouseMove = (event: MouseEvent): void => {
            const resizeState = resizeStateRef.current;

            if (!resizeState) {
                return;
            }

            const config = columnConfigs.find((column: IColumnConfig): boolean => column.key === resizeState.columnKey);

            if (!config) {
                return;
            }

            const nextWidth = Math.max(config.minWidth, resizeState.startWidth + (event.clientX - resizeState.startX));

            setColumnWidths((prev: Record<ColumnKey, number>): Record<ColumnKey, number> => ({
                ...prev,
                [resizeState.columnKey]: nextWidth
            }));
        };

        const handleMouseUp = (): void => {
            resizeStateRef.current = null;
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return (): void => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    const showFeatureDialog = React.useCallback((title: string, message: string): void => {
        setDialogTitle(title);
        setDialogMessage(message);
        setShowDialog(true);
    }, []);

    const hideDialog = React.useCallback((): void => {
        setShowDialog(false);
    }, []);

    const handleSort = React.useCallback((field: AllAuthorizationsSortField): void => {
        setSortField((currentField: AllAuthorizationsSortField): AllAuthorizationsSortField => {
            if (currentField === field) {
                setSortDirection((currentDirection: "asc" | "desc"): "asc" | "desc" => currentDirection === "asc" ? "desc" : "asc");
                return currentField;
            }

            setSortDirection(field === "title" ? "asc" : "desc");
            return field;
        });
    }, []);

    const handleFilterChange = React.useCallback((
        key: keyof IAllAuthorizationsFilters,
        value: string
    ): void => {
        setFilters((prev: IAllAuthorizationsFilters): IAllAuthorizationsFilters => ({
            ...prev,
            [key]: value
        }));
    }, []);

    const handleResetFilters = React.useCallback((): void => {
        setFilters({ ...defaultFilters });
        history.push(`/all-authorizations/${defaultPresetView}`);
    }, [history]);

    const handleChangeView = React.useCallback((_event: React.SyntheticEvent, value: AllAuthorizationsPresetView): void => {
        history.push(`/all-authorizations/${value}`);
    }, [history]);

    const handleExport = React.useCallback((): void => {
        exportAllAuthorizationRows(sortedRows, "iwa-authorizations.csv");
    }, [sortedRows]);

    const openRowMenu = React.useCallback((event: React.MouseEvent<HTMLElement>, rowId: number): void => {
        setMenuAnchorEl(event.currentTarget);
        setMenuRowId(rowId);
    }, []);

    const closeRowMenu = React.useCallback((): void => {
        setMenuAnchorEl(null);
        setMenuRowId(undefined);
    }, []);

    const selectedMenuRow = React.useMemo((): IAllAuthorizationsRow | undefined => {
        return sortedRows.find((row: IAllAuthorizationsRow): boolean => row.authorization.Id === menuRowId);
    }, [menuRowId, sortedRows]);

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
            showFeatureDialog("Discard Draft Error", formatError(error));
        }
    }, [clearAuthorizationDetailCache, discardDraftRow, hideBusy, refresh, showBusy, showFeatureDialog, showSuccess]);

    const handleRowDoubleClick = React.useCallback((row: IAllAuthorizationsRow): void => {
        history.push(`/authorizations/view/${row.authorization.Id}`);
    }, [history]);

    const startColumnResize = React.useCallback((
        event: React.MouseEvent<HTMLSpanElement>,
        columnKey: ColumnKey
    ): void => {
        event.preventDefault();
        event.stopPropagation();

        resizeStateRef.current = {
            columnKey,
            startX: event.clientX,
            startWidth: columnWidths[columnKey]
        };
    }, [columnWidths]);

    const totalWidth = React.useMemo((): number => {
        return columnConfigs.reduce((sum: number, column: IColumnConfig): number => sum + columnWidths[column.key], 0);
    }, [columnWidths]);

    return (
        <Stack spacing={3}>
            <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "flex-start" }}
            >
                <PageHeader
                    title="All Authorizations"
                    subtitle="Browse every authorization in the system with preset views, quick filters, export, and workflow-aware status detail."
                />

                <Button
                    variant="contained"
                    startIcon={<DownloadOutlinedIcon />}
                    onClick={handleExport}
                    disabled={sortedRows.length === 0}
                    sx={{ alignSelf: { xs: "stretch", md: "flex-start" } }}
                >
                    Export
                </Button>
            </Stack>

            <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3 }}>
                <Stack spacing={2}>
                    <Box
                        sx={{
                            display: "grid",
                            gap: 1.25,
                            gridTemplateColumns: {
                                xs: "1fr",
                                md: "repeat(2, minmax(0, 1fr))",
                                xl: "minmax(0, 400px) repeat(3, minmax(150px, 300px))"
                            },
                            alignItems: "center"
                        }}
                    >
                        <TextField
                            placeholder="Search title, contract, entities, invoice, approver, or status..."
                            value={filters.searchText}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>): void => handleFilterChange("searchText", event.target.value)}
                            fullWidth
                            sx={{
                                maxWidth: { xl: 400 }
                            }}
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

                        <TextField
                            select
                            label="Entity"
                            value={filters.entity}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>): void => handleFilterChange("entity", event.target.value)}
                            sx={{
                                minWidth: 150,
                                maxWidth: 300,
                                width: "100%"
                            }}
                        >
                            <MenuItem value="">All Entities</MenuItem>
                            {entityOptions.map((option: string) => (
                                <MenuItem key={option} value={option}>
                                    {option}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            select
                            label="OG"
                            value={filters.og}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>): void => handleFilterChange("og", event.target.value)}
                            sx={{
                                minWidth: 150,
                                maxWidth: 300,
                                width: "100%"
                            }}
                        >
                            <MenuItem value="">All OGs</MenuItem>
                            {ogOptions.map((option: string) => (
                                <MenuItem key={option} value={option}>
                                    {option}
                                </MenuItem>
                            ))}
                        </TextField>

                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: "minmax(0, 1fr) auto",
                                gap: 1,
                                alignItems: "center",
                                minWidth: 0
                            }}
                        >
                            <TextField
                                select
                                label="LOB"
                                value={filters.lob}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>): void => handleFilterChange("lob", event.target.value)}
                                sx={{
                                    minWidth: 150,
                                    maxWidth: 300,
                                    width: "100%"
                                }}
                            >
                                <MenuItem value="">All LOBs</MenuItem>
                                {lobOptions.map((option: string) => (
                                    <MenuItem key={option} value={option}>
                                        {option}
                                    </MenuItem>
                                ))}
                            </TextField>

                            <Tooltip title="Reset filters">
                                <IconButton
                                    onClick={handleResetFilters}
                                    sx={{
                                        justifySelf: "end",
                                        alignSelf: "center",
                                        flexShrink: 0
                                    }}
                                >
                                    <FilterAltOffOutlinedIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Box>
                </Stack>
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
                                {presetViews.find((view) => view.value === selectedView)?.label ?? "All"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {sortedRows.length} item{sortedRows.length === 1 ? "" : "s"} shown • double-click a row to open details
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {getPresetSummary(selectedView)}
                            </Typography>
                        </Box>

                        <Typography variant="caption" color="text.secondary">
                            Drag the header edges to resize columns.
                        </Typography>
                    </Stack>

                    {isBootLoading && (
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 2 }}>
                            <CircularProgress size={22} />
                            <Typography color="text.secondary">
                                Loading authorizations...
                            </Typography>
                        </Stack>
                    )}

                    {!isBootLoading && sortedRows.length === 0 && (
                        <Box sx={{ py: 4 }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                                No authorizations match the current view.
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Adjust the preset or filters to broaden the results.
                            </Typography>
                        </Box>
                    )}

                    {!isBootLoading && sortedRows.length > 0 && (
                        <>
                            <TableContainer sx={{ overflowX: "auto" }}>
                                <Table size="small" sx={{ minWidth: totalWidth, tableLayout: "fixed" }}>
                                    <TableHead>
                                        <TableRow>
                                            {columnConfigs.map((column: IColumnConfig): JSX.Element => {
                                                const isSortable = !!column.sortField;
                                                const isActiveSort = column.sortField === sortField;

                                                return (
                                                    <TableCell
                                                        key={column.key}
                                                        align={column.align}
                                                        sx={{
                                                            width: columnWidths[column.key],
                                                            minWidth: column.minWidth,
                                                            position: "relative",
                                                            whiteSpace: "nowrap",
                                                            userSelect: "none"
                                                        }}
                                                    >
                                                        {isSortable ? (
                                                            <TableSortLabel
                                                                active={isActiveSort}
                                                                direction={isActiveSort ? sortDirection : "asc"}
                                                                onClick={(): void => {
                                                                    if (column.sortField) {
                                                                        handleSort(column.sortField);
                                                                    }
                                                                }}
                                                            >
                                                                {column.label}
                                                            </TableSortLabel>
                                                        ) : (
                                                            column.label
                                                        )}

                                                        {column.key !== "actions" && (
                                                            <Box
                                                                component="span"
                                                                onMouseDown={(event: React.MouseEvent<HTMLSpanElement>): void => startColumnResize(event, column.key)}
                                                                sx={{
                                                                    position: "absolute",
                                                                    top: 0,
                                                                    right: -4,
                                                                    width: 8,
                                                                    height: "100%",
                                                                    cursor: "col-resize",
                                                                    zIndex: 2
                                                                }}
                                                            />
                                                        )}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {pagedRows.map((row: IAllAuthorizationsRow): JSX.Element => (
                                            <TableRow
                                                key={row.authorization.Id}
                                                hover
                                                onDoubleClick={(): void => handleRowDoubleClick(row)}
                                                sx={{ cursor: "pointer" }}
                                            >
                                                <TableCell sx={{ width: columnWidths.title, minWidth: columnConfigs[0].minWidth, verticalAlign: "top" }}>
                                                    <Stack spacing={0.5}>
                                                        <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                                                            <Typography fontWeight={600}>
                                                                {row.authorization.Title}
                                                            </Typography>
                                                            {row.hasMods && (
                                                                <Tooltip title={`${row.authorization.modCount ?? 0} modification(s)`}>
                                                                        <Chip
                                                                            icon={<AccountTreeOutlinedIcon />}
                                                                        label={formatModLabel(row.authorization.modCount)}
                                                                        size="small"
                                                                        variant="outlined"
                                                                        sx={{ height: 22 }}
                                                                    />
                                                                </Tooltip>
                                                            )}
                                                        </Stack>
                                                        <Typography variant="body2" color="text.secondary" noWrap>
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

                                                <TableCell sx={{ width: columnWidths.authorizationStatus, verticalAlign: "top" }}>
                                                    <Chip
                                                        label={row.isModDraft ? "Mod Draft" : authorizationStatusLabels[row.authorization.authorizationStatus]}
                                                        color={getStatusChipColor(row.authorization.authorizationStatus)}
                                                        size="small"
                                                    />
                                                </TableCell>

                                                <TableCell sx={{ width: columnWidths.workflowStatus, verticalAlign: "top" }}>
                                                    {row.currentRun ? (
                                                        <Chip
                                                            label={workflowRunStatusLabels[row.currentRun.runStatus]}
                                                            color={getWorkflowStatusChipColor(row.currentRun.runStatus)}
                                                            size="small"
                                                        />
                                                    ) : (
                                                        <Typography variant="body2" color="text.secondary">
                                                            No workflow
                                                        </Typography>
                                                    )}
                                                </TableCell>

                                                <TableCell sx={{ width: columnWidths.pendingRole, verticalAlign: "top" }}>
                                                    <Stack spacing={0.5}>
                                                        <Typography variant="body2">
                                                            {row.currentRun?.pendingRole ? workflowRoleLabels[row.currentRun.pendingRole as keyof typeof workflowRoleLabels] : "—"}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {row.currentRun?.pendingApprover?.Title ?? "No current assignee"}
                                                </Typography>
                                                    </Stack>
                                                </TableCell>

                                                <TableCell sx={{ width: columnWidths.assignedDate, verticalAlign: "top" }}>
                                                    <Stack spacing={0.5}>
                                                        <Typography variant="body2">
                                                            {row.currentRun?.stepAssignedDate ? formatDate(row.currentRun.stepAssignedDate, true) : "—"}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {row.currentRun?.stepAssignedDate ? formatSinceDate(row.currentRun.stepAssignedDate) : ""}
                                                        </Typography>
                                                    </Stack>
                                                </TableCell>

                                                <TableCell align="right" sx={{ width: columnWidths.baseGrandTotal, verticalAlign: "top" }}>
                                                    <Typography variant="body2">
                                                        {formatCurrency(row.authorization.baseGrandTotal)}
                                                    </Typography>
                                                </TableCell>

                                                <TableCell align="right" sx={{ width: columnWidths.approvedGrandTotal, verticalAlign: "top" }}>
                                                    <Typography variant="body2">
                                                        {formatCurrency(row.authorization.approvedGrandTotal)}
                                                    </Typography>
                                                </TableCell>

                                                <TableCell align="center" sx={{ width: columnWidths.modCount, verticalAlign: "top" }}>
                                                    <Typography variant="body2">
                                                        {row.authorization.modCount ?? 0}
                                                    </Typography>
                                                </TableCell>

                                                <TableCell align="center" sx={{ width: columnWidths.actions, verticalAlign: "top" }}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={(event: React.MouseEvent<HTMLElement>): void => {
                                                            event.stopPropagation();
                                                            openRowMenu(event, row.authorization.Id);
                                                        }}
                                                    >
                                                        <MoreVertIcon fontSize="small" />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <TablePagination
                                component="div"
                                count={sortedRows.length}
                                page={page}
                                onPageChange={(_event: React.MouseEvent<HTMLButtonElement> | null, nextPage: number): void => setPage(nextPage)}
                                rowsPerPage={pageSize}
                                onRowsPerPageChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
                                    setPageSize(parseInt(event.target.value, 10));
                                    setPage(0);
                                }}
                                rowsPerPageOptions={[10, 25, 50, 100]}
                            />
                        </>
                    )}
                </Stack>
            </Paper>

            <Menu
                anchorEl={menuAnchorEl}
                open={!!menuAnchorEl}
                onClose={closeRowMenu}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
                <MenuItem
                    onClick={() => {
                        closeRowMenu();
                        if (selectedMenuRow) {
                            handleRowDoubleClick(selectedMenuRow);
                        }
                    }}
                >
                    <OpenInNewOutlinedIcon fontSize="small" sx={{ mr: 1.25 }} />
                    View Details
                </MenuItem>

                <MenuItem
                    onClick={() => {
                        closeRowMenu();
                        showFeatureDialog(
                            "View Mods",
                            selectedMenuRow?.hasMods
                                ? `Show the modifications for ${selectedMenuRow.authorization.Title}. The mods drill-in is the next action surface to wire up.`
                                : "This authorization does not have any modifications yet."
                        );
                    }}
                >
                    <AccountTreeOutlinedIcon fontSize="small" sx={{ mr: 1.25 }} />
                    View Mods
                </MenuItem>

                <MenuItem
                    onClick={() => {
                        closeRowMenu();
                        if (canEditAuthorization(selectedMenuRow)) {
                            history.push(`/authorizations/edit/${selectedMenuRow!.authorization.Id}`, {
                                returnTo: `/all-authorizations/${selectedView}`,
                                modId: selectedMenuRow?.draftMod?.Id
                            });
                            return;
                        }

                        showFeatureDialog(
                            "Edit Authorization",
                            `${selectedMenuRow?.authorization.Title ?? "This authorization"} can only be edited before the first workflow decision is recorded.`
                        );
                    }}
                >
                    <EditOutlinedIcon fontSize="small" sx={{ mr: 1.25 }} />
                    {selectedMenuRow?.isModDraft ? "Resume Mod" : selectedMenuRow?.authorization.authorizationStatus === "draft" ? "Resume Draft" : "Edit Authorization"}
                </MenuItem>

                <MenuItem
                    onClick={() => {
                        closeRowMenu();
                        if (selectedMenuRow?.authorization.pdfUrl) {
                            window.open(selectedMenuRow.authorization.pdfUrl, "_blank", "noopener,noreferrer");
                            return;
                        }

                        showFeatureDialog(
                            "Authorization PDF",
                            "This authorization does not have a generated PDF yet."
                        );
                    }}
                >
                    <PictureAsPdfOutlinedIcon fontSize="small" sx={{ mr: 1.25 }} />
                    View PDF
                </MenuItem>

                {(selectedMenuRow?.authorization.authorizationStatus === "draft" || selectedMenuRow?.isModDraft) && (
                    <MenuItem
                        onClick={() => {
                            closeRowMenu();
                            setDiscardDraftRow(selectedMenuRow);
                        }}
                    >
                        <DeleteOutlineOutlinedIcon fontSize="small" sx={{ mr: 1.25 }} />
                        {selectedMenuRow?.isModDraft ? "Discard Mod" : "Discard Draft"}
                    </MenuItem>
                )}

                <MenuItem
                    onClick={() => {
                        closeRowMenu();
                        showFeatureDialog(
                            "Workflow",
                            `Open the workflow detail for ${selectedMenuRow?.authorization.Title ?? "this authorization"}. This workflow drill-in is staged but not built yet.`
                        );
                    }}
                >
                    <OpenInBrowserOutlinedIcon fontSize="small" sx={{ mr: 1.25 }} />
                    View Workflow
                </MenuItem>
            </Menu>

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

            <AlertDialog open={showDialog} title={dialogTitle} message={dialogMessage} onClose={hideDialog} />
        </Stack>
    );
};
