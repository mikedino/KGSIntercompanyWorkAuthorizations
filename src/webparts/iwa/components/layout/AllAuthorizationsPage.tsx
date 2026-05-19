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
    FormControlLabel,
    IconButton,
    Menu,
    MenuItem,
    Paper,
    Stack,
    Switch,
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
import { formatDate, formatError, formatRelationship } from "../common/utils";
import { useIwa } from "../data/iwaContext";
import { IModItem, workflowRoleLabels } from "../data/props";
import { useHistory, useParams } from "react-router-dom";
import { AuthorizationService } from "../authorizations/iwaService";
import { canUserEditAuthorization } from "../authorizations/authorizationEditAccess";
import { ModService } from "../mods/modService";
import { useShellUi } from "../ui/ShellUiContext";
import {
    AllAuthorizationsPresetView,
    AllAuthorizationsSortField,
    buildAllAuthorizationRows,
    exportAllAuthorizationRows,
    filterAllAuthorizationRows,
    getUniqueFilterValues,
    getRowAuthorizationStatusColor,
    getRowAuthorizationStatusLabel,
    getRowWorkflowStatusColor,
    getRowWorkflowStatusLabel,
    IAllAuthorizationsFilters,
    IAllAuthorizationsRow,
    sortAllAuthorizationRows
} from "./allAuthorizationsUtils";
import { formatModLabel } from "../authorizations/view/iwaViewUtils";

type ColumnKey =
    | "title"
    | "contractDetails"
    | "authorizationStatus"
    | "workflowStatus"
    | "pendingRole"
    | "assignedDate"
    | "period"
    | "createdDate"
    | "actions";

interface IColumnConfig {
    key: ColumnKey;
    label: string;
    tooltip?: string;
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
    { key: "title", label: "Authorization", sortField: "title", minWidth: 205, defaultWidth: 220 },
    { key: "contractDetails", label: "Contract Details", sortField: "customerContractCode", minWidth: 135, defaultWidth: 145 },
    { key: "authorizationStatus", label: "Status", sortField: "authorizationStatus", minWidth: 100, defaultWidth: 110 },
    { key: "workflowStatus", label: "WF Status", sortField: "workflowStatus", minWidth: 105, defaultWidth: 115 },
    { key: "pendingRole", label: "WF Pending Role", sortField: "pendingRole", minWidth: 135, defaultWidth: 145 },
    { key: "assignedDate", label: "Assigned Date", sortField: "assignedDate", minWidth: 115, defaultWidth: 125 },
    { key: "period", label: "Period", sortField: "periodEnd", minWidth: 100, defaultWidth: 110 },
    {
        key: "createdDate",
        label: "Created",
        tooltip: "Shows who created the base IWA and when. If the IWA has Mods, this shows the creator and created date for the latest Mod.",
        sortField: "createdDate",
        minWidth: 135,
        defaultWidth: 145
    },
    { key: "actions", label: "", minWidth: 56, defaultWidth: 56, align: "center" }
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

const getDateValue = (value?: string): number => {
    if (!value) {
        return 0;
    }

    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
};

const buildLatestModMap = (mods: IModItem[]): Map<number, IModItem> => {
    return mods.reduce((map: Map<number, IModItem>, mod: IModItem): Map<number, IModItem> => {
        const authorizationId = mod.authorization?.Id;

        if (!authorizationId) {
            return map;
        }

        const existing = map.get(authorizationId);
        const isNewerModNumber = (mod.modNumber ?? 0) > (existing?.modNumber ?? 0);
        const isSameModButNewer = (mod.modNumber ?? 0) === (existing?.modNumber ?? 0) && getDateValue(mod.Created) > getDateValue(existing?.Created);

        if (!existing || isNewerModNumber || isSameModButNewer) {
            map.set(authorizationId, mod);
        }

        return map;
    }, new Map<number, IModItem>());
};

const formatQueueAge = (value?: string): string => {
    if (!value) {
        return "";
    }

    const assignedDate = new Date(value);

    if (Number.isNaN(assignedDate.getTime())) {
        return "";
    }

    const today = new Date();
    const assignedStart = new Date(assignedDate.getFullYear(), assignedDate.getMonth(), assignedDate.getDate()).getTime();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const days = Math.max(0, Math.floor((todayStart - assignedStart) / (1000 * 60 * 60 * 24)));

    return `${days} ${days === 1 ? "day" : "days"} in queue`;
};

const renderColumnLabel = (column: IColumnConfig): React.ReactNode => {
    if (!column.tooltip) {
        return column.label;
    }

    return (
        <Tooltip title={column.tooltip}>
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
                {column.label}
            </Box>
        </Tooltip>
    );
};

const canEditAuthorization = (
    row: IAllAuthorizationsRow | undefined,
    currentUser: ReturnType<typeof useIwa>["currentUser"],
    appUsers: ReturnType<typeof useIwa>["appUsers"]
): boolean => {
    if (!row) {
        return false;
    }

    if (!canUserEditAuthorization(row.authorization, currentUser, appUsers)) {
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
        appUsers,
        authorizations,
        currentUser,
        draftAuthorizations,
        draftModsByAuthorizationId,
        isBootLoading,
        lastRefreshed,
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
    const [latestModsByAuthorizationId, setLatestModsByAuthorizationId] = React.useState<Map<number, IModItem>>(new Map());
    const [showDrafts, setShowDrafts] = React.useState<boolean>(false);
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
        return buildAllAuthorizationRows([...draftAuthorizations, ...authorizations], runByAuthorizationId, draftModsByAuthorizationId, latestModsByAuthorizationId);
    }, [authorizations, draftAuthorizations, draftModsByAuthorizationId, latestModsByAuthorizationId, runByAuthorizationId]);

    const visibleRows = React.useMemo((): IAllAuthorizationsRow[] => {
        if (showDrafts) {
            return allRows;
        }

        return allRows.filter((row: IAllAuthorizationsRow): boolean => row.authorization.authorizationStatus !== "draft");
    }, [allRows, showDrafts]);

    const entityOptions = React.useMemo((): string[] => {
        return getUniqueFilterValues(visibleRows, (row: IAllAuthorizationsRow): Array<string | undefined> => [
            row.authorization.donorEntity,
            row.authorization.receivingEntity
        ]);
    }, [visibleRows]);

    const ogOptions = React.useMemo((): string[] => {
        return getUniqueFilterValues(visibleRows, (row: IAllAuthorizationsRow): Array<string | undefined> => [row.authorization.og]);
    }, [visibleRows]);

    const lobOptions = React.useMemo((): string[] => {
        return getUniqueFilterValues(visibleRows, (row: IAllAuthorizationsRow): Array<string | undefined> => [row.authorization.lob]);
    }, [visibleRows]);

    const filteredRows = React.useMemo((): IAllAuthorizationsRow[] => {
        return filterAllAuthorizationRows(visibleRows, selectedView, filters);
    }, [filters, selectedView, visibleRows]);

    const sortedRows = React.useMemo((): IAllAuthorizationsRow[] => {
        return sortAllAuthorizationRows(filteredRows, sortField, sortDirection);
    }, [filteredRows, sortDirection, sortField]);

    const pagedRows = React.useMemo((): IAllAuthorizationsRow[] => {
        const start = page * pageSize;
        return sortedRows.slice(start, start + pageSize);
    }, [page, pageSize, sortedRows]);

    React.useEffect((): void => {
        setPage(0);
    }, [filters, selectedView, showDrafts]);

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

    React.useEffect((): (() => void) => {
        let isMounted = true;

        const loadLatestMods = async (): Promise<void> => {
            try {
                const mods = await ModService.getAll();

                if (isMounted) {
                    setLatestModsByAuthorizationId(buildLatestModMap(mods));
                }
            } catch (error) {
                if (isMounted) {
                    showFeatureDialog("Load Mods Error", formatError(error));
                }
            }
        };

        loadLatestMods().catch((error: unknown): void => {
            if (isMounted) {
                showFeatureDialog("Load Mods Error", formatError(error));
            }
        });

        return (): void => {
            isMounted = false;
        };
    }, [lastRefreshed, showFeatureDialog]);

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
    const selectedMenuRowCanEdit = React.useMemo((): boolean => {
        return canEditAuthorization(selectedMenuRow, currentUser, appUsers);
    }, [appUsers, currentUser, selectedMenuRow]);

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
                await AuthorizationService.recalculateModCount(authorizationId);
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
                <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }}>
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
                            flex: 1,
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
                    <Tooltip title={showDrafts ? "Base draft authorizations are visible." : "Base draft authorizations are hidden. Mod drafts remain visible."}>
                        <FormControlLabel
                            sx={{ alignSelf: { xs: "flex-end", md: "center" }, mr: { xs: 1, md: 1.5 }, whiteSpace: "nowrap" }}
                            control={
                                <Switch
                                    checked={showDrafts}
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>): void => setShowDrafts(event.target.checked)}
                                />
                            }
                            label={showDrafts ? "Show Drafts" : "Hide Drafts"}
                        />
                    </Tooltip>
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
                                                                {renderColumnLabel(column)}
                                                            </TableSortLabel>
                                                        ) : (
                                                            renderColumnLabel(column)
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
                                                        <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                            sx={{
                                                                display: "-webkit-box",
                                                                overflow: "hidden",
                                                                WebkitBoxOrient: "vertical",
                                                                WebkitLineClamp: 2
                                                            }}
                                                        >
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

                                                <TableCell sx={{ width: columnWidths.contractDetails, verticalAlign: "top" }}>
                                                    <Stack spacing={0.35}>
                                                        <Typography variant="body2">{row.authorization.customerContractCode || "—"}</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Invoice: {row.authorization.invoice || "—"}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {row.authorization.contractType === "tm" ? "T&M" : "FFP"}
                                                        </Typography>
                                                    </Stack>
                                                </TableCell>

                                                <TableCell sx={{ width: columnWidths.authorizationStatus, verticalAlign: "top" }}>
                                                    <Chip
                                                        label={getRowAuthorizationStatusLabel(row)}
                                                        color={getRowAuthorizationStatusColor(row)}
                                                        size="small"
                                                    />
                                                </TableCell>

                                                <TableCell sx={{ width: columnWidths.workflowStatus, verticalAlign: "top" }}>
                                                    {row.currentRun ? (
                                                        <Chip
                                                            label={getRowWorkflowStatusLabel(row)}
                                                            color={getRowWorkflowStatusColor(row)}
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
                                                            {formatQueueAge(row.currentRun?.stepAssignedDate)}
                                                        </Typography>
                                                    </Stack>
                                                </TableCell>

                                                <TableCell sx={{ width: columnWidths.period, verticalAlign: "top" }}>
                                                    <Stack spacing={0.35}>
                                                        <Typography variant="body2">{formatDate(row.authorization.periodStart, false)}</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            to {formatDate(row.authorization.periodEnd, false)}
                                                        </Typography>
                                                    </Stack>
                                                </TableCell>

                                                <TableCell sx={{ width: columnWidths.createdDate, verticalAlign: "top" }}>
                                                    <Stack spacing={0.5}>
                                                        <Typography variant="body2" noWrap>
                                                            {row.createdByName || "—"}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {row.createdOn ? formatDate(row.createdOn, true) : ""}
                                                        </Typography>
                                                    </Stack>
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
                        if (selectedMenuRow) {
                            history.push(`/authorizations/view/${selectedMenuRow.authorization.Id}?tab=mods`);
                        }
                    }}
                >
                    <AccountTreeOutlinedIcon fontSize="small" sx={{ mr: 1.25 }} />
                    View Mods
                </MenuItem>

                <MenuItem
                    onClick={() => {
                        closeRowMenu();
                        if (selectedMenuRowCanEdit) {
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
                    disabled={!selectedMenuRowCanEdit}
                >
                    <EditOutlinedIcon fontSize="small" sx={{ mr: 1.25 }} />
                    {selectedMenuRow?.isModDraft ? "Resume Mod" : selectedMenuRow?.authorization.authorizationStatus === "draft" ? "Resume Draft" : "Edit Authorization"}
                </MenuItem>

                <MenuItem
                    onClick={() => {
                        closeRowMenu();
                        history.push(`/authorizations/export/${selectedMenuRow!.authorization.Id}`);
                    }}
                >
                    <PictureAsPdfOutlinedIcon fontSize="small" sx={{ mr: 1.25 }} />
                    Export Preview
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
                        if (selectedMenuRow) {
                            history.push(`/authorizations/view/${selectedMenuRow.authorization.Id}?tab=workflow`);
                        }
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
