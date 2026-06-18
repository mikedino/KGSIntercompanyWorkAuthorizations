import * as React from "react";
import {
    Autocomplete,    Alert,    Box,    Button,    Checkbox,    Dialog,    DialogActions,    DialogContent,
    DialogTitle,    FormControlLabel,    Grid,    MenuItem,    Paper,    Stack,    Table,    TableBody,    TableCell,    TableContainer,
    TableHead,    TableRow,    TextField,    Tooltip,    Typography
} from "@mui/material";
import InputAdornment from "@mui/material/InputAdornment";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import KeyboardArrowDownOutlinedIcon from "@mui/icons-material/KeyboardArrowDownOutlined";
import KeyboardArrowUpOutlinedIcon from "@mui/icons-material/KeyboardArrowUpOutlined";
import { IPersonaProps } from "@fluentui/react";
import { IPeoplePickerContext } from "@pnp/spfx-controls-react/lib/PeoplePicker";
import { MuiPeoplePicker } from "../ui/CustomPeoplePicker";
import { ChargingPeriod, IJobItem, IPeoplePicker, TravelLineType } from "../data/props";
import { formatCurrency, formatCurrencyInputValue, normalizeDecimalInput } from "../common/utils";
import { IwaPriorResourcesPanel } from "./workPackage/IwaPriorResourcesPanel";
import { IEditableFfpLaborRow, IEditableResourceRow, IEditableTravelRow, IPriorResourceRow } from "./workPackage/workPackageTypes";

export interface IIwaWorkPackageStepProps {
    contractType: "tm" | "ffp";
    jobs: IJobItem[];
    laborCategories: string[];
    states: string[];
    peoplePickerContext: IPeoplePickerContext;
    resourceRows: IEditableResourceRow[];
    travelRows: IEditableTravelRow[];
    ffpLaborRows: IEditableFfpLaborRow[];
    priorResourceRows?: IPriorResourceRow[];
    showPriorResources?: boolean;
    submitted: boolean;
    onAddResource: (row?: IEditableResourceRow) => void;
    onRemoveResource: (id: string) => void;
    onUpdateResource: (id: string, patch: Partial<IEditableResourceRow>) => void;
    onAddTravel: (row?: IEditableTravelRow) => void;
    onRemoveTravel: (id: string) => void;
    onUpdateTravel: (id: string, patch: Partial<IEditableTravelRow>) => void;
    onAddFfpLabor: (row?: IEditableFfpLaborRow) => void;
    onRemoveFfpLabor: (id: string) => void;
    onUpdateFfpLabor: (id: string, patch: Partial<IEditableFfpLaborRow>) => void;
}

const lineTypeOptions: Array<{ value: TravelLineType; label: string; }> = [
    { value: "travel", label: "Travel" },
    { value: "odc", label: "ODC" },
    { value: "other", label: "Other" }
];

const chargingPeriodOptions: Array<{ value: ChargingPeriod; label: string; }> = [
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "yearly", label: "Yearly" }
];

const quietTableSx = {
    "& thead tr": {
        bgcolor: "background.default"
    },
    "& th": {
        fontWeight: 600,
        borderBottom: "1px solid",
        borderColor: "divider"
    },
    "& td": {
        borderBottom: "1px solid",
        borderColor: "divider"
    },
    "& tbody tr:last-child td": {
        borderBottom: 0
    }
};

const totalsRowSx = {
    "& td": {
        fontWeight: 600,
        fontStyle: "italic"
    }
};

const createEmptyResourceDraft = (): IEditableResourceRow => ({
    id: "",
    state: "",
    comments: "",
    jobId: "",
    laborCategory: "",
    standardHours: "",
    stoHours: false,
    overtimeHours: "",
    annualSalary: "",
    standardRate: "",
    overtimeRate: ""
});

const createEmptyTravelDraft = (): IEditableTravelRow => ({
    id: "",
    lineType: "travel",
    jobId: "",
    description: "",
    amount: "",
    comments: ""
});

const createEmptyFfpLaborDraft = (): IEditableFfpLaborRow => ({
    id: "",
    jobId: "",
    chargingPeriod: "monthly",
    periodQty: "",
    lumpSumAmount: "",
    resourceRowIds: [],
    comments: ""
});

const formatHours = (value: number): string => {
    const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
};

const requiredLabel = (label: string): string => `${label} *`;

const infoLabel = (label: string, tooltip: string, required = false): React.ReactNode => (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
        {required ? requiredLabel(label) : label}
        <Tooltip title={tooltip} arrow placement="top">
            <InfoOutlinedIcon
                sx={{ color: "text.secondary", cursor: "help", fontSize: 18, verticalAlign: "middle" }}
            />
        </Tooltip>
    </Box>
);

type RemoveConfirmation = {
    id: string;
    message: string;
    title: string;
    type: "resource" | "travel" | "ffpLabor";
};

const toPeoplePickerValue = (item?: IPersonaProps): IPeoplePicker | undefined => {
    if (!item?.id || !item.text || !item.secondaryText) {
        return undefined;
    }

    return {
        Id: parseInt(item.id, 10),
        Title: item.text,
        EMail: item.secondaryText,
        id: item.id,
        text: item.text,
        secondaryText: item.secondaryText
    };
};

const filterJobOptions = (options: IJobItem[], inputValue: string): IJobItem[] => {
    const search = inputValue.trim().toLowerCase();

    if (!search) {
        return options.slice(0, 50);
    }

    return options.filter((option: IJobItem): boolean => {
        return (
            (option.field_13 ?? "").toLowerCase().includes(search) ||
            (option.field_19 ?? "").toLowerCase().includes(search)
        );
    }).slice(0, 50);
};

const filterAllJobOptions = (options: IJobItem[], inputValue: string): IJobItem[] => {
    const search = inputValue.trim().toLowerCase();

    if (!search) {
        return options;
    }

    return options.filter((option: IJobItem): boolean => {
        return (
            (option.field_13 ?? "").toLowerCase().includes(search) ||
            (option.field_19 ?? "").toLowerCase().includes(search)
        );
    });
};

const renderJobOption = (props: React.HTMLAttributes<HTMLLIElement>, option: IJobItem): JSX.Element => (
    <li {...props} key={option.Id}>
        <Stack spacing={0.15}>
            <Typography variant="body1" fontWeight={600}>
                {option.field_13}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {option.field_19 || "No job title"}
            </Typography>
        </Stack>
    </li>
);

export const IwaWorkPackageStep: React.FC<IIwaWorkPackageStepProps> = ({
    contractType,
    jobs,
    laborCategories,
    states,
    peoplePickerContext,
    resourceRows,
    travelRows,
    ffpLaborRows,
    priorResourceRows = [],
    showPriorResources = false,
    submitted,
    onAddResource,
    onRemoveResource,
    onUpdateResource,
    onAddTravel,
    onRemoveTravel,
    onUpdateTravel,
    onAddFfpLabor,
    onRemoveFfpLabor,
    onUpdateFfpLabor
}): JSX.Element => {
    const jobOptions = React.useMemo<IJobItem[]>(() => {
        return [...jobs].sort((left, right) => (left.field_13 ?? "").localeCompare(right.field_13 ?? ""));
    }, [jobs]);
    const laborCategoryOptions = React.useMemo<string[]>(() => {
        return [...laborCategories].sort((left, right) => left.localeCompare(right));
    }, [laborCategories]);

    const [resourceDialogOpen, setResourceDialogOpen] = React.useState(false);
    const [resourceDraft, setResourceDraft] = React.useState<IEditableResourceRow>(createEmptyResourceDraft());
    const [resourceDraftErrors, setResourceDraftErrors] = React.useState<Record<string, string>>({});

    const [travelDialogOpen, setTravelDialogOpen] = React.useState(false);
    const [travelDraft, setTravelDraft] = React.useState<IEditableTravelRow>(createEmptyTravelDraft());
    const [travelDraftErrors, setTravelDraftErrors] = React.useState<Record<string, string>>({});
    const [travelAmountFocused, setTravelAmountFocused] = React.useState(false);
    const [ffpDialogOpen, setFfpDialogOpen] = React.useState(false);
    const [ffpDraft, setFfpDraft] = React.useState<IEditableFfpLaborRow>(createEmptyFfpLaborDraft());
    const [ffpDraftErrors, setFfpDraftErrors] = React.useState<Record<string, string>>({});
    const [ffpAmountFocused, setFfpAmountFocused] = React.useState(false);
    const [priorResourcesOpen, setPriorResourcesOpen] = React.useState(false);
    const [removeConfirmation, setRemoveConfirmation] = React.useState<RemoveConfirmation | undefined>(undefined);
    const resourceTotals = React.useMemo(() => {
        return resourceRows.reduce((totals, row) => ({
            standardHours: totals.standardHours + Number(normalizeDecimalInput(row.standardHours) || 0),
            overtimeHours: totals.overtimeHours + Number(normalizeDecimalInput(row.overtimeHours) || 0)
        }), { standardHours: 0, overtimeHours: 0 });
    }, [resourceRows]);
    const resourceDraftApprovedHours = React.useMemo(() => {
        const employeeId = resourceDraft.employee?.Id;

        if (!employeeId) {
            return undefined;
        }

        return priorResourceRows.find((row) => row.employee.Id === employeeId);
    }, [priorResourceRows, resourceDraft.employee?.Id]);
    const resourceDraftHoursPreview = React.useMemo(() => {
        const approvedStandardHours = resourceDraftApprovedHours?.approvedTotalStandardHours ?? 0;
        const approvedOvertimeHours = resourceDraftApprovedHours?.approvedTotalOvertimeHours ?? 0;
        const newStandardHours = Number(normalizeDecimalInput(resourceDraft.standardHours) || 0);
        const newOvertimeHours = Number(normalizeDecimalInput(resourceDraft.overtimeHours) || 0);

        return {
            approvedStandardHours,
            approvedOvertimeHours,
            approvedTotalHours: approvedStandardHours + approvedOvertimeHours,
            newTotalHours: newStandardHours + newOvertimeHours,
            combinedTotalHours: approvedStandardHours + approvedOvertimeHours + newStandardHours + newOvertimeHours
        };
    }, [resourceDraft.overtimeHours, resourceDraft.standardHours, resourceDraftApprovedHours]);
    const ffpTotal = React.useMemo(() => {
        return ffpLaborRows.reduce((total, row) => {
            const amount = Number(normalizeDecimalInput(row.lumpSumAmount) || 0);
            return total + amount;
        }, 0);
    }, [ffpLaborRows]);
    const travelTotal = React.useMemo(() => {
        return travelRows.reduce((total, row) => total + Number(normalizeDecimalInput(row.amount) || 0), 0);
    }, [travelRows]);

    const assignedResourceRows = React.useMemo(
        () => resourceRows.filter((row) => !!row.employee?.Id),
        [resourceRows]
    );
    const availablePriorResourceRows = React.useMemo((): IPriorResourceRow[] => {
        const copiedEmployeeIds = new Set(
            resourceRows
                .map((row) => row.employee?.Id)
                .filter((value): value is number => typeof value === "number")
        );

        return priorResourceRows.filter((row) => !copiedEmployeeIds.has(row.employee.Id));
    }, [priorResourceRows, resourceRows]);

    const getResourceNames = React.useCallback((resourceRowIds: string[]): string => {
        const names = resourceRowIds
            .map((id) => resourceRows.find((resource) => resource.id === id)?.employee?.Title)
            .filter(Boolean) as string[];

        return names.length ? names.join(", ") : "—";
    }, [resourceRows]);

    const getFfpLinesForResource = React.useCallback((resourceRowId: string): string => {
        const labels = ffpLaborRows
            .filter((line) => line.resourceRowIds.includes(resourceRowId))
            .map((line) => line.jobId || "Unassigned Job");

        return labels.length ? labels.join(", ") : "—";
    }, [ffpLaborRows]);

    const copyPriorResource = React.useCallback((row: IPriorResourceRow): void => {
        onAddResource({
            id: "",
            employee: row.employee,
            state: row.state,
            comments: "",
            jobId: row.jobId,
            laborCategory: row.laborCategory,
            standardHours: "",
            stoHours: false,
            overtimeHours: "",
            annualSalary: "",
            standardRate: "",
            overtimeRate: ""
        });
    }, [onAddResource]);

    const copyAllPriorResources = React.useCallback((): void => {
        availablePriorResourceRows.forEach(copyPriorResource);
    }, [availablePriorResourceRows, copyPriorResource]);

    const requestRemoveResource = React.useCallback((row: IEditableResourceRow): void => {
        setRemoveConfirmation({
            id: row.id,
            type: "resource",
            title: "Remove Resource?",
            message: `Remove ${row.employee?.Title ?? "this resource"} from this IWA? Associated FFP line assignments will also be cleared.`
        });
    }, []);

    const requestRemoveTravel = React.useCallback((row: IEditableTravelRow): void => {
        setRemoveConfirmation({
            id: row.id,
            type: "travel",
            title: "Remove Travel / ODC Line?",
            message: `Remove this ${row.lineType.toUpperCase()} line from this IWA?`
        });
    }, []);

    const requestRemoveFfpLabor = React.useCallback((row: IEditableFfpLaborRow): void => {
        setRemoveConfirmation({
            id: row.id,
            type: "ffpLabor",
            title: "Remove FFP Line?",
            message: `Remove ${row.jobId || "this FFP labor / CLIN line"} from this IWA?`
        });
    }, []);

    const confirmRemove = React.useCallback((): void => {
        if (!removeConfirmation) {
            return;
        }

        if (removeConfirmation.type === "resource") {
            onRemoveResource(removeConfirmation.id);
        } else if (removeConfirmation.type === "travel") {
            onRemoveTravel(removeConfirmation.id);
        } else {
            onRemoveFfpLabor(removeConfirmation.id);
        }

        setRemoveConfirmation(undefined);
    }, [onRemoveFfpLabor, onRemoveResource, onRemoveTravel, removeConfirmation]);

    const openNewResourceDialog = React.useCallback((): void => {
        setResourceDraft(createEmptyResourceDraft());
        setResourceDraftErrors({});
        setResourceDialogOpen(true);
    }, []);

    const openEditResourceDialog = React.useCallback((row: IEditableResourceRow): void => {
        setResourceDraft({ ...row });
        setResourceDraftErrors({});
        setResourceDialogOpen(true);
    }, []);

    const closeResourceDialog = React.useCallback((): void => {
        setResourceDialogOpen(false);
    }, []);

    const saveResourceDraft = React.useCallback((): void => {
        const nextErrors: Record<string, string> = {};

        if (!resourceDraft.employee?.Id) {
            nextErrors.employee = "Employee is required.";
        }

        if (!resourceDraft.state.trim()) {
            nextErrors.state = "State is required.";
        }

        if (contractType === "tm" && !resourceDraft.jobId.trim()) {
            nextErrors.jobId = "Job ID is required for T&M resources.";
        }

        if (!resourceDraft.laborCategory.trim()) {
            nextErrors.laborCategory = "Labor category is required.";
        }

        if (contractType === "tm") {
            const standardHours = normalizeDecimalInput(resourceDraft.standardHours);
            const overtimeHours = normalizeDecimalInput(resourceDraft.overtimeHours);
            const totalHours = Number(standardHours || 0) + Number(overtimeHours || 0);

            if (Number.isNaN(totalHours) || totalHours <= 0) {
                nextErrors.standardHours = "Total standard and overtime hours must be greater than zero.";
            } else {
                if (standardHours.trim() && Number.isNaN(Number(standardHours))) {
                    nextErrors.standardHours = "Standard hours must be numeric.";
                }

                if (overtimeHours.trim() && Number.isNaN(Number(overtimeHours))) {
                    nextErrors.overtimeHours = "Overtime hours must be numeric.";
                }
            }
        }

        setResourceDraftErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        if (resourceDraft.id) {
            onUpdateResource(resourceDraft.id, {
                ...resourceDraft,
                standardHours: normalizeDecimalInput(resourceDraft.standardHours),
                stoHours: !!resourceDraft.stoHours,
                overtimeHours: normalizeDecimalInput(resourceDraft.overtimeHours)
            });
        } else {
            onAddResource({
                ...resourceDraft,
                standardHours: normalizeDecimalInput(resourceDraft.standardHours),
                stoHours: !!resourceDraft.stoHours,
                overtimeHours: normalizeDecimalInput(resourceDraft.overtimeHours)
            });
        }

        setResourceDialogOpen(false);
    }, [contractType, onAddResource, onUpdateResource, resourceDraft]);

    const openNewTravelDialog = React.useCallback((): void => {
        setTravelDraft(createEmptyTravelDraft());
        setTravelDraftErrors({});
        setTravelAmountFocused(false);
        setTravelDialogOpen(true);
    }, []);

    const openEditTravelDialog = React.useCallback((row: IEditableTravelRow): void => {
        setTravelDraft({ ...row });
        setTravelDraftErrors({});
        setTravelAmountFocused(false);
        setTravelDialogOpen(true);
    }, []);

    const closeTravelDialog = React.useCallback((): void => {
        setTravelDialogOpen(false);
        setTravelAmountFocused(false);
    }, []);

    const openNewFfpDialog = React.useCallback((): void => {
        setFfpDraft(createEmptyFfpLaborDraft());
        setFfpDraftErrors({});
        setFfpAmountFocused(false);
        setFfpDialogOpen(true);
    }, []);

    const openEditFfpDialog = React.useCallback((row: IEditableFfpLaborRow): void => {
        setFfpDraft({ ...row });
        setFfpDraftErrors({});
        setFfpAmountFocused(false);
        setFfpDialogOpen(true);
    }, []);

    const closeFfpDialog = React.useCallback((): void => {
        setFfpDialogOpen(false);
        setFfpAmountFocused(false);
    }, []);

    const saveFfpDraft = React.useCallback((): void => {
        const nextErrors: Record<string, string> = {};
        const normalizedPeriodQty = normalizeDecimalInput(ffpDraft.periodQty);
        const normalizedLumpSumAmount = normalizeDecimalInput(ffpDraft.lumpSumAmount);

        if (!ffpDraft.jobId.trim()) {
            nextErrors.jobId = "Job ID is required.";
        }

        if (!normalizedPeriodQty.trim()) {
            nextErrors.periodQty = "Number of periods is required.";
        } else if (Number.isNaN(Number(normalizedPeriodQty)) || Number(normalizedPeriodQty) <= 0) {
            nextErrors.periodQty = "Number of periods must be greater than zero.";
        }

        if (!normalizedLumpSumAmount.trim()) {
            nextErrors.lumpSumAmount = "Lump sum amount is required.";
        } else if (Number.isNaN(Number(normalizedLumpSumAmount)) || Number(normalizedLumpSumAmount) <= 0) {
            nextErrors.lumpSumAmount = "Lump sum amount must be greater than zero.";
        }

        if (ffpDraft.resourceRowIds.length === 0) {
            nextErrors.resourceRowIds = "Select at least one associated resource.";
        }

        setFfpDraftErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        const nextDraft = {
            ...ffpDraft,
            periodQty: normalizedPeriodQty,
            lumpSumAmount: normalizedLumpSumAmount
        };

        if (ffpDraft.id) {
            onUpdateFfpLabor(ffpDraft.id, nextDraft);
        } else {
            onAddFfpLabor(nextDraft);
        }

        setFfpDialogOpen(false);
    }, [ffpDraft, onAddFfpLabor, onUpdateFfpLabor]);

    const saveTravelDraft = React.useCallback((): void => {
        const nextErrors: Record<string, string> = {};
        const normalizedAmount = normalizeDecimalInput(travelDraft.amount);

        if (!travelDraft.lineType) {
            nextErrors.lineType = "Line Type is required.";
        }

        if (!travelDraft.jobId.trim()) {
            nextErrors.jobId = "Job ID is required.";
        }

        if (!travelDraft.description.trim()) {
            nextErrors.description = "Description is required.";
        }

        if (!normalizedAmount.trim()) {
            nextErrors.amount = "Amount is required.";
        } else if (Number.isNaN(Number(normalizedAmount))) {
            nextErrors.amount = "Amount must be numeric.";
        }

        setTravelDraftErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        if (travelDraft.id) {
            onUpdateTravel(travelDraft.id, { ...travelDraft, amount: normalizedAmount });
        } else {
            onAddTravel({ ...travelDraft, amount: normalizedAmount });
        }

        setTravelDialogOpen(false);
    }, [onAddTravel, onUpdateTravel, travelDraft]);

    return (
        <Stack spacing={3}>
            <Paper sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto", width: "100%" }}>
                <Stack spacing={2.5}>
                    <Stack spacing={1.5}>
                        <Typography variant="h6" fontWeight={600}>
                            Resources
                        </Typography>
                        <Alert severity="info">
                            {contractType === "ffp"
                                ? "Build the resource roster first. You will assign each user to the CLIN and provide the Lump Sum amount below."
                                : "Add the resources and hours here. HR will provide the salary information during the review process."}
                        </Alert>
                    </Stack>

                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                            {resourceRows.length} resource line{resourceRows.length === 1 ? "" : "s"}
                        </Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
                            {showPriorResources && priorResourceRows.length > 0 && (
                                <Button
                                    variant={priorResourcesOpen ? "outlined" : "contained"}
                                    color="info"
                                    startIcon={priorResourcesOpen ? <KeyboardArrowUpOutlinedIcon /> : <KeyboardArrowDownOutlinedIcon />}
                                    onClick={() => setPriorResourcesOpen((open) => !open)}
                                >
                                    {priorResourcesOpen ? "Hide Prior Resources" : "Show Prior Resources"}
                                </Button>
                            )}
                            <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openNewResourceDialog}>
                                Add Resource
                            </Button>
                        </Stack>
                    </Stack>

                    {showPriorResources && (
                        <IwaPriorResourcesPanel
                            open={priorResourcesOpen}
                            priorResourceRows={availablePriorResourceRows}
                            onCopyAll={copyAllPriorResources}
                            onCopyResource={copyPriorResource}
                        />
                    )}

                    {resourceRows.length === 0 ? (
                        <Box sx={{ py: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                                No resources have been added yet.
                            </Typography>
                        </Box>
                    ) : (
                        <TableContainer>
                            <Table size="small" sx={quietTableSx}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Employee</TableCell>
                                        <TableCell>State</TableCell>
                                        <TableCell>Labor Category</TableCell>
                                        {contractType === "ffp" && <TableCell>FFP Job / CLIN</TableCell>}
                                        {contractType === "tm" && <TableCell>Job ID</TableCell>}
                                        {contractType === "tm" && <TableCell>Std Hrs</TableCell>}
                                        {contractType === "tm" && <TableCell align="center">STO</TableCell>}
                                        {contractType === "tm" && <TableCell>OT Hrs</TableCell>}
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {resourceRows.map((row) => (
                                        <TableRow key={row.id} hover>
                                            <TableCell>{row.employee?.Title ?? "—"}</TableCell>
                                            <TableCell>{row.state || "—"}</TableCell>
                                            <TableCell>{row.laborCategory || "—"}</TableCell>
                                            {contractType === "ffp" && <TableCell>{getFfpLinesForResource(row.id)}</TableCell>}
                                            {contractType === "tm" && <TableCell>{row.jobId || "—"}</TableCell>}
                                            {contractType === "tm" && <TableCell>{row.standardHours || "—"}</TableCell>}
                                            {contractType === "tm" && (
                                                <TableCell align="center">
                                                    {row.stoHours ? <CheckOutlinedIcon color="success" fontSize="small" /> : "—"}
                                                </TableCell>
                                            )}
                                            {contractType === "tm" && <TableCell>{row.overtimeHours || "—"}</TableCell>}
                                            <TableCell align="right">
                                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                    <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => openEditResourceDialog(row)}>
                                                        Edit
                                                    </Button>
                                                    <Button size="small" color="error" startIcon={<DeleteOutlineOutlinedIcon />} onClick={() => requestRemoveResource(row)}>
                                                        Remove
                                                    </Button>
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {resourceRows.length > 1 && (
                                        <TableRow sx={totalsRowSx}>
                                            <TableCell colSpan={contractType === "tm" ? 4 : 4}>Totals</TableCell>
                                            {contractType === "tm" && <TableCell>{resourceTotals.standardHours || "—"}</TableCell>}
                                            {contractType === "tm" && <TableCell align="center">—</TableCell>}
                                            {contractType === "tm" && <TableCell>{resourceTotals.overtimeHours || "—"}</TableCell>}
                                            <TableCell />
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}

                    {contractType === "ffp" && (
                        <Stack spacing={1.5}>
                            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                                <Box>
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        FFP Labor / CLINs
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Group each fixed-price Job ID / CLIN with its charging period, lump sum, and associated resources.
                                    </Typography>
                                </Box>
                                <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openNewFfpDialog}>
                                    Add FFP Line
                                </Button>
                            </Stack>
                            {submitted && ffpLaborRows.length === 0 && (
                                <Typography variant="body2" color="error">
                                    Add at least one FFP labor / CLIN line.
                                </Typography>
                            )}
                            {ffpLaborRows.length === 0 ? (
                                <Box sx={{ py: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        No FFP labor / CLIN lines have been added yet.
                                    </Typography>
                                </Box>
                            ) : (
                                <TableContainer>
                                    <Table size="small" sx={quietTableSx}>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Job ID / CLIN</TableCell>
                                                <TableCell>Charging Period</TableCell>
                                                <TableCell align="right">Periods</TableCell>
                                                <TableCell align="right">Total Amount</TableCell>
                                                <TableCell>Resources</TableCell>
                                                <TableCell align="right">Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {ffpLaborRows.map((row) => {
                                                const amount = Number(normalizeDecimalInput(row.lumpSumAmount) || 0);
                                                const total = amount;

                                                return (
                                                    <TableRow key={row.id} hover>
                                                        <TableCell>{row.jobId || "—"}</TableCell>
                                                        <TableCell>{chargingPeriodOptions.find((option) => option.value === row.chargingPeriod)?.label ?? row.chargingPeriod}</TableCell>
                                                       <TableCell align="right">{row.periodQty || "—"}</TableCell>
                                                        <TableCell align="right">{total ? formatCurrency(total) : "—"}</TableCell>
                                                        <TableCell>{getResourceNames(row.resourceRowIds)}</TableCell>
                                                        <TableCell align="right">
                                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                                <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => openEditFfpDialog(row)}>
                                                                    Edit
                                                                </Button>
                                                                <Button size="small" color="error" startIcon={<DeleteOutlineOutlinedIcon />} onClick={() => requestRemoveFfpLabor(row)}>
                                                                    Remove
                                                                </Button>
                                                            </Stack>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                            {ffpLaborRows.length > 1 && (
                                                <TableRow sx={totalsRowSx}>
                                                    <TableCell colSpan={3}>Totals</TableCell>
                                                    <TableCell align="right">{formatCurrency(ffpTotal)}</TableCell>
                                                    <TableCell />
                                                    <TableCell />
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Stack>
                    )}
                </Stack>
            </Paper>

            <Paper sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto", width: "100%" }}>
                <Stack spacing={2.5}>
                    <Stack spacing={0.5}>
                        <Typography variant="h6" fontWeight={600}>
                            Travel / ODC
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Add optional travel or ODC lines then review them in the list below.
                        </Typography>
                    </Stack>

                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                            {travelRows.length} travel / ODC line{travelRows.length === 1 ? "" : "s"}
                        </Typography>
                        <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openNewTravelDialog}>
                            Add Travel / ODC
                        </Button>
                    </Stack>

                    {travelRows.length === 0 ? (
                        <Box sx={{ py: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                                No travel or ODC lines have been added yet.
                            </Typography>
                        </Box>
                    ) : (
                        <TableContainer>
                            <Table size="small" sx={quietTableSx}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Job ID</TableCell>
                                        <TableCell>Description</TableCell>
                                        <TableCell>Amount</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {travelRows.map((row) => (
                                        <TableRow key={row.id} hover>
                                            <TableCell>{lineTypeOptions.find((option) => option.value === row.lineType)?.label ?? row.lineType}</TableCell>
                                            <TableCell>{row.jobId || "—"}</TableCell>
                                            <TableCell>{row.description || "—"}</TableCell>
                                            <TableCell>{row.amount ? formatCurrency(Number(row.amount)) : "—"}</TableCell>
                                            <TableCell align="right">
                                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                    <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => openEditTravelDialog(row)}>
                                                        Edit
                                                    </Button>
                                                    <Button size="small" color="error" startIcon={<DeleteOutlineOutlinedIcon />} onClick={() => requestRemoveTravel(row)}>
                                                        Remove
                                                    </Button>
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {travelRows.length > 1 && (
                                        <TableRow sx={totalsRowSx}>
                                            <TableCell colSpan={3}>Totals</TableCell>
                                            <TableCell>{formatCurrency(travelTotal)}</TableCell>
                                            <TableCell />
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Stack>
            </Paper>

            <Dialog open={resourceDialogOpen} onClose={closeResourceDialog} fullWidth maxWidth="lg">
                <DialogTitle>{resourceDraft.id ? "Edit Resource" : "Add Resource"}</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3} sx={{ pt: 1 }}>
                        <Alert severity="info">
                            {showPriorResources
                                ? "For Mods, enter only the resource details and hours being added for this Mod. T&M hours entered here are for this Mod only and do not include previously approved hours. Once a previously utilized resource is selected, their previously approved hours will be visible below for reference."
                                : "For T&M resources, enter the total standard and overtime hours requested during this period."}
                        </Alert>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <MuiPeoplePicker
                                    label={requiredLabel("Employee")}
                                    context={peoplePickerContext}
                                    value={resourceDraft.employee?.EMail ? [resourceDraft.employee.EMail] : undefined}
                                    showtooltip
                                    tooltipMessage="Select the employee or resource receiving the labor hours."
                                    onChange={(items) => {
                                        const employee = toPeoplePickerValue(items[0]);

                                        setResourceDraft((prev) => {
                                            const employeeChanged = (prev.employee?.Id ?? 0) !== (employee?.Id ?? 0);

                                            return {
                                                ...prev,
                                                employee,
                                                // Salary and derived rates belong to the selected employee,
                                                // not to the resource row. When a rejected Mod is corrected
                                                // by swapping people on the same row, carrying the prior
                                                // person's salary forward would silently price the new person
                                                // with stale compensation.
                                                annualSalary: employeeChanged ? "" : prev.annualSalary,
                                                standardRate: employeeChanged ? "" : prev.standardRate,
                                                overtimeRate: employeeChanged ? "" : prev.overtimeRate
                                            };
                                        });
                                    }}
                                    error={Boolean(resourceDraftErrors.employee)}
                                    helperText={resourceDraftErrors.employee}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Autocomplete
                                    freeSolo
                                    options={states}
                                    value={resourceDraft.state}
                                    onChange={(_, value: string | null) => setResourceDraft((prev) => ({ ...prev, state: value ?? "" }))}
                                    onInputChange={(_, value: string) => setResourceDraft((prev) => ({ ...prev, state: value }))}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label={requiredLabel("State of Residence")}
                                            fullWidth
                                            error={Boolean(resourceDraftErrors.state)}
                                            helperText={resourceDraftErrors.state}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Autocomplete
                                    freeSolo
                                    options={laborCategoryOptions}
                                    value={resourceDraft.laborCategory}
                                    onInputChange={(_, value) => setResourceDraft((prev) => ({ ...prev, laborCategory: value }))}
                                    onChange={(_, value) => setResourceDraft((prev) => ({ ...prev, laborCategory: value ?? "" }))}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label={infoLabel("Labor Category", "Manually enter a labor category.", true)}
                                            fullWidth
                                            error={Boolean(resourceDraftErrors.laborCategory)}
                                            helperText={resourceDraftErrors.laborCategory}
                                        />
                                    )}
                                />
                            </Grid>
                            {contractType === "tm" && (
                                <>
                                    <Grid size={{ xs: 12, md: 5 }}>
                                        <Autocomplete
                                            options={jobOptions}
                                            value={jobOptions.find((job) => job.field_13 === resourceDraft.jobId) ?? null}
                                            onChange={(_, value: IJobItem | null) => setResourceDraft((prev) => ({ ...prev, jobId: value?.field_13 ?? "" }))}
                                            filterOptions={(options, state) => filterAllJobOptions(options, state.inputValue)}
                                            getOptionLabel={(option: IJobItem) => option.field_13 ?? ""}
                                            isOptionEqualToValue={(option, value) => option.Id === value.Id}
                                            renderOption={renderJobOption}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label={infoLabel("Job ID", "Charge code for this resource's labor hours.", true)}
                                                    error={Boolean(resourceDraftErrors.jobId)}
                                                    helperText={resourceDraftErrors.jobId}
                                                    sx={{ "& .MuiInputBase-input": { textOverflow: "clip" } }}
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 5, md: 2.5 }}>
                                        <TextField
                                            label={infoLabel("Standard Hours", showPriorResources
                                                ? "For Mods, enter only the standard hours being added by this Mod. Do not include previously approved hours."
                                                : "Enter the standard hours requested for this authorization period.", true)}
                                            fullWidth
                                            value={resourceDraft.standardHours}
                                            onChange={(event) => setResourceDraft((prev) => ({ ...prev, standardHours: normalizeDecimalInput(event.target.value) }))}
                                            error={Boolean(resourceDraftErrors.standardHours)}
                                            helperText={resourceDraftErrors.standardHours}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 7, md: 2 }}>
                                        <FormControlLabel
                                            sx={{
                                                minHeight: 56,
                                                alignItems: "center",
                                                ml: 0,
                                                px: 0,
                                                width: "100%",
                                                mt: 0
                                            }}
                                            control={
                                                <Checkbox
                                                    checked={!!resourceDraft.stoHours}
                                                    onChange={(event) => setResourceDraft((prev) => ({ ...prev, stoHours: event.target.checked }))}
                                                />
                                            }
                                            label={infoLabel("STO Hours?", "Check this box if any standard hours for this resource need to be marked as STO in JAMIS.")}
                                            slotProps={{
                                                typography: {
                                                    variant: "body2",
                                                    sx: { color: "text.primary" }
                                                }
                                            }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 2.5 }}>
                                        <TextField
                                            label={infoLabel("Overtime Hours", showPriorResources
                                                ? "For Mods, enter only the overtime hours being added by this Mod."
                                                : "Enter the overtime hours requested for this authorization period.")}
                                            fullWidth
                                            value={resourceDraft.overtimeHours}
                                            onChange={(event) => setResourceDraft((prev) => ({ ...prev, overtimeHours: normalizeDecimalInput(event.target.value) }))}
                                            error={Boolean(resourceDraftErrors.overtimeHours)}
                                            helperText={resourceDraftErrors.overtimeHours}
                                        />
                                    </Grid>
                                </>
                            )}
                            <Grid size={{ xs: 12, md: showPriorResources && contractType === "tm" ? 7 : 12 }}>
                                <TextField
                                    label="Comments"
                                    fullWidth
                                    multiline
                                    minRows={showPriorResources && contractType === "tm" ? 3 : 2}
                                    value={resourceDraft.comments}
                                    onChange={(event) => setResourceDraft((prev) => ({ ...prev, comments: event.target.value }))}
                                />
                            </Grid>
                            {showPriorResources && contractType === "tm" && (
                                <Grid size={{ xs: 12, md: 5 }}>
                                    <Paper
                                        variant="outlined"
                                        sx={(theme) => ({
                                            px: 2,
                                            py: 1.35,
                                            minHeight: 92,
                                            display: "flex",
                                            alignItems: "center",
                                            borderColor: "success.main",
                                            borderLeft: `4px solid ${theme.palette.success.main}`,
                                            backgroundColor: theme.palette.mode === "dark"
                                                ? "rgba(50, 200, 90, 0.08)"
                                                : "rgba(46, 125, 50, 0.06)"
                                        })}
                                    >
                                        {resourceDraft.employee?.Id ? (
                                            <Stack spacing={0.25}>
                                                <Typography variant="caption" color="success.main" fontWeight={700} sx={{ textTransform: "uppercase" }}>
                                                    Previously Approved Resource Hours
                                                </Typography>
                                                <Typography variant="body2">
                                                    Prior approved: <strong>{formatHours(resourceDraftHoursPreview.approvedTotalHours)} hrs</strong> ({formatHours(resourceDraftHoursPreview.approvedStandardHours)} std / {formatHours(resourceDraftHoursPreview.approvedOvertimeHours)} OT)
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    New on this Mod: {formatHours(resourceDraftHoursPreview.newTotalHours)} hrs
                                                </Typography>
                                                <Typography variant="body2" fontWeight={700}>
                                                    Total after this Mod: {formatHours(resourceDraftHoursPreview.combinedTotalHours)} hrs
                                                </Typography>
                                            </Stack>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                                Select an employee to show previously approved hours.
                                            </Typography>
                                        )}
                                    </Paper>
                                </Grid>
                            )}
                        </Grid>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeResourceDialog}>Cancel</Button>
                    <Button variant="contained" onClick={saveResourceDraft}>Save Resource</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={ffpDialogOpen} onClose={closeFfpDialog} fullWidth maxWidth="md">
                <DialogTitle>{ffpDraft.id ? "Edit FFP Labor / CLIN" : "Add FFP Labor / CLIN"}</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3} sx={{ pt: 1 }}>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12 }}>
                                <Autocomplete
                                    options={jobOptions}
                                    value={jobOptions.find((job) => job.field_13 === ffpDraft.jobId) ?? null}
                                    onChange={(_, value: IJobItem | null) => setFfpDraft((prev) => ({ ...prev, jobId: value?.field_13 ?? "" }))}
                                    filterOptions={(options, state) => filterJobOptions(options, state.inputValue)}
                                    getOptionLabel={(option: IJobItem) => option.field_13 ?? ""}
                                    isOptionEqualToValue={(option, value) => option.Id === value.Id}
                                    renderOption={renderJobOption}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Job ID / CLIN"
                                            required
                                            error={Boolean(ffpDraftErrors.jobId)}
                                            helperText={ffpDraftErrors.jobId}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField
                                    select
                                    label="Charging Period"
                                    fullWidth
                                    value={ffpDraft.chargingPeriod}
                                    onChange={(event) => setFfpDraft((prev) => ({ ...prev, chargingPeriod: event.target.value as ChargingPeriod }))}
                                >
                                    {chargingPeriodOptions.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField
                                    label="Number of Periods"
                                    fullWidth
                                    required
                                    value={ffpDraft.periodQty}
                                    onChange={(event) => setFfpDraft((prev) => ({ ...prev, periodQty: normalizeDecimalInput(event.target.value) }))}
                                    error={Boolean(ffpDraftErrors.periodQty)}
                                    helperText={ffpDraftErrors.periodQty}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField
                                    label="Lump Sum Amount"
                                    fullWidth
                                    required
                                    value={ffpAmountFocused ? ffpDraft.lumpSumAmount : formatCurrencyInputValue(ffpDraft.lumpSumAmount)}
                                    onFocus={() => setFfpAmountFocused(true)}
                                    onBlur={() => setFfpAmountFocused(false)}
                                    onChange={(event) => setFfpDraft((prev) => ({ ...prev, lumpSumAmount: normalizeDecimalInput(event.target.value) }))}
                                    error={Boolean(ffpDraftErrors.lumpSumAmount)}
                                    helperText={ffpDraftErrors.lumpSumAmount}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start">$</InputAdornment>
                                    }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <Autocomplete
                                    multiple
                                    disableCloseOnSelect
                                    options={assignedResourceRows}
                                    value={assignedResourceRows.filter((row) => ffpDraft.resourceRowIds.includes(row.id))}
                                    onChange={(_, values) => setFfpDraft((prev) => ({ ...prev, resourceRowIds: values.map((row) => row.id) }))}
                                    getOptionLabel={(option) => option.employee?.Title ?? "Unnamed resource"}
                                    isOptionEqualToValue={(option, value) => option.id === value.id}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Associated Resources"
                                            required
                                            error={Boolean(ffpDraftErrors.resourceRowIds)}
                                            helperText={ffpDraftErrors.resourceRowIds || "Add resources first, then associate them to this Job ID / CLIN."}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    label="Comments"
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    value={ffpDraft.comments}
                                    onChange={(event) => setFfpDraft((prev) => ({ ...prev, comments: event.target.value }))}
                                />
                            </Grid>
                        </Grid>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeFfpDialog}>Cancel</Button>
                    <Button variant="contained" onClick={saveFfpDraft}>Save FFP Line</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={travelDialogOpen} onClose={closeTravelDialog} fullWidth maxWidth="md">
                <DialogTitle>{travelDraft.id ? "Edit Travel / ODC" : "Add Travel / ODC"}</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3} sx={{ pt: 1 }}>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField
                                    select
                                    label="Line Type"
                                    fullWidth
                                    required
                                    value={travelDraft.lineType}
                                    onChange={(event) => setTravelDraft((prev) => ({ ...prev, lineType: event.target.value as TravelLineType }))}
                                    error={Boolean(travelDraftErrors.lineType)}
                                    helperText={travelDraftErrors.lineType}
                                >
                                    {lineTypeOptions.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Autocomplete
                                    options={jobOptions}
                                    value={jobOptions.find((job) => job.field_13 === travelDraft.jobId) ?? null}
                                    onChange={(_, value: IJobItem | null) => setTravelDraft((prev) => ({ ...prev, jobId: value?.field_13 ?? "" }))}
                                    filterOptions={(options, state) => filterAllJobOptions(options, state.inputValue)}
                                    getOptionLabel={(option: IJobItem) => option.field_13 ?? ""}
                                    isOptionEqualToValue={(option, value) => option.Id === value.Id}
                                    renderOption={renderJobOption}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Job ID"
                                            required
                                            error={Boolean(travelDraftErrors.jobId)}
                                            helperText={travelDraftErrors.jobId}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField
                                    label="Amount"
                                    fullWidth
                                    required
                                    value={travelAmountFocused ? travelDraft.amount : formatCurrencyInputValue(travelDraft.amount)}
                                    onChange={(event) => {
                                        const normalized = normalizeDecimalInput(event.target.value);
                                        setTravelDraft((prev) => ({ ...prev, amount: normalized }));
                                    }}
                                    onFocus={() => setTravelAmountFocused(true)}
                                    onBlur={() => {
                                        setTravelAmountFocused(false);
                                        setTravelDraft((prev) => ({ ...prev, amount: normalizeDecimalInput(prev.amount) }));
                                    }}
                                    error={Boolean(travelDraftErrors.amount)}
                                    helperText={travelDraftErrors.amount}
                                    slotProps={{
                                        input: {
                                            startAdornment: <InputAdornment position="start">$</InputAdornment>
                                        }
                                    }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    label="Description"
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    required
                                    value={travelDraft.description}
                                    onChange={(event) => setTravelDraft((prev) => ({ ...prev, description: event.target.value }))}
                                    error={Boolean(travelDraftErrors.description)}
                                    helperText={travelDraftErrors.description}
                                />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    label="Comments"
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    value={travelDraft.comments}
                                    onChange={(event) => setTravelDraft((prev) => ({ ...prev, comments: event.target.value }))}
                                />
                            </Grid>
                        </Grid>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeTravelDialog}>Cancel</Button>
                    <Button variant="contained" onClick={saveTravelDraft}>Save Line</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={!!removeConfirmation} onClose={() => setRemoveConfirmation(undefined)} fullWidth maxWidth="sm">
                <DialogTitle>{removeConfirmation?.title ?? "Remove Line?"}</DialogTitle>
                <DialogContent>
                    <Typography color="text.secondary">
                        {removeConfirmation?.message ?? "Remove this line from the IWA?"}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRemoveConfirmation(undefined)}>Cancel</Button>
                    <Button variant="contained" color="error" startIcon={<DeleteOutlineOutlinedIcon />} onClick={confirmRemove}>
                        Remove
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
};
