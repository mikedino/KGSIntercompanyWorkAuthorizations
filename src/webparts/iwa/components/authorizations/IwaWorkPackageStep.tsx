import * as React from "react";
import {
    Autocomplete,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    MenuItem,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography
} from "@mui/material";
import InputAdornment from "@mui/material/InputAdornment";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { IPersonaProps } from "@fluentui/react";
import { IPeoplePickerContext } from "@pnp/spfx-controls-react/lib/PeoplePicker";
import { MuiPeoplePicker } from "../ui/CustomPeoplePicker";
import { IJobItem, IPeoplePicker, TravelLineType } from "../data/props";
import { formatCurrency, formatCurrencyInputValue, normalizeDecimalInput } from "../common/utils";

export interface IEditableResourceRow {
    id: string;
    employee?: IPeoplePicker;
    state: string;
    comments: string;
    jobId: string;
    laborCategory: string;
    standardHours: string;
    overtimeHours: string;
    annualSalary: string;
    standardRate: string;
    overtimeRate: string;
}

export interface IEditableTravelRow {
    id: string;
    lineType: TravelLineType;
    jobId: string;
    description: string;
    amount: string;
    comments: string;
}

export interface IFfpLaborConfig {
    jobId: string;
    laborCategory: string;
    comments: string;
}

export interface IIwaWorkPackageStepProps {
    contractType: "tm" | "ffp";
    jobs: IJobItem[];
    states: string[];
    peoplePickerContext: IPeoplePickerContext;
    resourceRows: IEditableResourceRow[];
    travelRows: IEditableTravelRow[];
    ffpLaborConfig: IFfpLaborConfig;
    submitted: boolean;
    onAddResource: (row?: IEditableResourceRow) => void;
    onRemoveResource: (id: string) => void;
    onUpdateResource: (id: string, patch: Partial<IEditableResourceRow>) => void;
    onAddTravel: (row?: IEditableTravelRow) => void;
    onRemoveTravel: (id: string) => void;
    onUpdateTravel: (id: string, patch: Partial<IEditableTravelRow>) => void;
    onUpdateFfpLaborConfig: (patch: Partial<IFfpLaborConfig>) => void;
}

const lineTypeOptions: Array<{ value: TravelLineType; label: string; }> = [
    { value: "travel", label: "Travel" },
    { value: "odc", label: "ODC" },
    { value: "other", label: "Other" }
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
    states,
    peoplePickerContext,
    resourceRows,
    travelRows,
    ffpLaborConfig,
    submitted,
    onAddResource,
    onRemoveResource,
    onUpdateResource,
    onAddTravel,
    onRemoveTravel,
    onUpdateTravel,
    onUpdateFfpLaborConfig
}): JSX.Element => {
    const jobOptions = React.useMemo<IJobItem[]>(() => {
        return [...jobs].sort((left, right) => (left.field_13 ?? "").localeCompare(right.field_13 ?? ""));
    }, [jobs]);

    const [resourceDialogOpen, setResourceDialogOpen] = React.useState(false);
    const [resourceDraft, setResourceDraft] = React.useState<IEditableResourceRow>(createEmptyResourceDraft());
    const [resourceDraftErrors, setResourceDraftErrors] = React.useState<Record<string, string>>({});

    const [travelDialogOpen, setTravelDialogOpen] = React.useState(false);
    const [travelDraft, setTravelDraft] = React.useState<IEditableTravelRow>(createEmptyTravelDraft());
    const [travelDraftErrors, setTravelDraftErrors] = React.useState<Record<string, string>>({});
    const [travelAmountFocused, setTravelAmountFocused] = React.useState(false);
    const resourceTotals = React.useMemo(() => {
        return resourceRows.reduce((totals, row) => ({
            standardHours: totals.standardHours + Number(normalizeDecimalInput(row.standardHours) || 0),
            overtimeHours: totals.overtimeHours + Number(normalizeDecimalInput(row.overtimeHours) || 0)
        }), { standardHours: 0, overtimeHours: 0 });
    }, [resourceRows]);
    const travelTotal = React.useMemo(() => {
        return travelRows.reduce((total, row) => total + Number(normalizeDecimalInput(row.amount) || 0), 0);
    }, [travelRows]);

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

        if (contractType === "tm" && !resourceDraft.laborCategory.trim()) {
            nextErrors.laborCategory = "Labor category is required for T&M resources.";
        }

        if (contractType === "tm") {
            const standardHours = normalizeDecimalInput(resourceDraft.standardHours);
            const overtimeHours = normalizeDecimalInput(resourceDraft.overtimeHours);
            const hasHours = standardHours.trim() || overtimeHours.trim();

            if (!hasHours) {
                nextErrors.standardHours = "Enter standard hours, overtime hours, or both.";
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
                overtimeHours: normalizeDecimalInput(resourceDraft.overtimeHours)
            });
        } else {
            onAddResource({
                ...resourceDraft,
                standardHours: normalizeDecimalInput(resourceDraft.standardHours),
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

    const saveTravelDraft = React.useCallback((): void => {
        const nextErrors: Record<string, string> = {};
        const normalizedAmount = normalizeDecimalInput(travelDraft.amount);

        if (!travelDraft.jobId.trim()) {
            nextErrors.jobId = "Job ID is required.";
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
                    <Stack spacing={0.5}>
                        <Typography variant="h6" fontWeight={600}>
                            Resources
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Build the employee roster here. Add rows in a dialog, capture the hours the you knows now. HR will complete the protected compensation details later in the workflow.
                        </Typography>
                    </Stack>

                    {contractType === "ffp" && (
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Stack spacing={1.5}>
                                <Typography variant="subtitle1" fontWeight={600}>
                                    Shared FFP Labor Line
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <Autocomplete
                                            options={jobOptions}
                                            value={jobOptions.find((job) => job.field_13 === ffpLaborConfig.jobId) ?? null}
                                            onChange={(_, value: IJobItem | null) => onUpdateFfpLaborConfig({ jobId: value?.field_13 ?? "" })}
                                            filterOptions={(options, state) => filterJobOptions(options, state.inputValue)}
                                            getOptionLabel={(option: IJobItem) => option.field_13 ?? ""}
                                            isOptionEqualToValue={(option, value) => option.Id === value.Id}
                                            renderOption={renderJobOption}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Job ID"
                                                    required
                                                    error={submitted && !ffpLaborConfig.jobId}
                                                    helperText={submitted && !ffpLaborConfig.jobId ? "Job ID is required." : "Shared job / CLIN for the single FFP labor line."}
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <TextField
                                            label="Labor Category"
                                            fullWidth
                                            required
                                            value={ffpLaborConfig.laborCategory}
                                            onChange={(event) => onUpdateFfpLaborConfig({ laborCategory: event.target.value })}
                                            error={submitted && !ffpLaborConfig.laborCategory.trim()}
                                            helperText={submitted && !ffpLaborConfig.laborCategory.trim() ? "Labor category is required." : "Shared labor category for the FFP labor line."}
                                        />
                                    </Grid>
                                </Grid>
                            </Stack>
                        </Paper>
                    )}

                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                            {resourceRows.length} resource line{resourceRows.length === 1 ? "" : "s"}
                        </Typography>
                        <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openNewResourceDialog}>
                            Add Resource
                        </Button>
                    </Stack>

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
                                        {contractType === "tm" && <TableCell>Job ID</TableCell>}
                                        {contractType === "tm" && <TableCell>Labor Category</TableCell>}
                                        {contractType === "tm" && <TableCell>Std Hrs</TableCell>}
                                        {contractType === "tm" && <TableCell>OT Hrs</TableCell>}
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {resourceRows.map((row) => (
                                        <TableRow key={row.id} hover>
                                            <TableCell>{row.employee?.Title ?? "—"}</TableCell>
                                            <TableCell>{row.state || "—"}</TableCell>
                                            {contractType === "tm" && <TableCell>{row.jobId || "—"}</TableCell>}
                                            {contractType === "tm" && <TableCell>{row.laborCategory || "—"}</TableCell>}
                                            {contractType === "tm" && <TableCell>{row.standardHours || "—"}</TableCell>}
                                            {contractType === "tm" && <TableCell>{row.overtimeHours || "—"}</TableCell>}
                                            <TableCell align="right">
                                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                    <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => openEditResourceDialog(row)}>
                                                        Edit
                                                    </Button>
                                                    <Button size="small" color="error" startIcon={<DeleteOutlineOutlinedIcon />} onClick={() => onRemoveResource(row.id)}>
                                                        Remove
                                                    </Button>
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {resourceRows.length > 1 && (
                                        <TableRow sx={totalsRowSx}>
                                            <TableCell colSpan={contractType === "tm" ? 4 : 2}>Totals</TableCell>
                                            {contractType === "tm" && <TableCell>{resourceTotals.standardHours || "—"}</TableCell>}
                                            {contractType === "tm" && <TableCell>{resourceTotals.overtimeHours || "—"}</TableCell>}
                                            <TableCell />
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
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
                                                    <Button size="small" color="error" startIcon={<DeleteOutlineOutlinedIcon />} onClick={() => onRemoveTravel(row.id)}>
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

            <Dialog open={resourceDialogOpen} onClose={closeResourceDialog} fullWidth maxWidth="md">
                <DialogTitle>{resourceDraft.id ? "Edit Resource" : "Add Resource"}</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3} sx={{ pt: 1 }}>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <MuiPeoplePicker
                                    label="Employee"
                                    context={peoplePickerContext}
                                    value={resourceDraft.employee?.EMail ? [resourceDraft.employee.EMail] : undefined}
                                    required
                                    onChange={(items) => {
                                        const employee = toPeoplePickerValue(items[0]);

                                        setResourceDraft((prev) => ({
                                            ...prev,
                                            employee
                                        }));
                                    }}
                                    error={Boolean(resourceDraftErrors.employee)}
                                    helperText={resourceDraftErrors.employee}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Autocomplete
                                    freeSolo
                                    options={states}
                                    value={resourceDraft.state}
                                    onChange={(_, value: string | null) => setResourceDraft((prev) => ({ ...prev, state: value ?? "" }))}
                                    onInputChange={(_, value: string) => setResourceDraft((prev) => ({ ...prev, state: value }))}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="State"
                                            fullWidth
                                            required
                                            error={Boolean(resourceDraftErrors.state)}
                                            helperText={resourceDraftErrors.state || "Choose from Config values or type one if needed."}
                                        />
                                    )}
                                />
                            </Grid>
                            {contractType === "tm" && (
                                <>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <Autocomplete
                                            options={jobOptions}
                                            value={jobOptions.find((job) => job.field_13 === resourceDraft.jobId) ?? null}
                                            onChange={(_, value: IJobItem | null) => setResourceDraft((prev) => ({ ...prev, jobId: value?.field_13 ?? "" }))}
                                            filterOptions={(options, state) => filterJobOptions(options, state.inputValue)}
                                            getOptionLabel={(option: IJobItem) => option.field_13 ?? ""}
                                            isOptionEqualToValue={(option, value) => option.Id === value.Id}
                                            renderOption={renderJobOption}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Job ID"
                                                    required
                                                    error={Boolean(resourceDraftErrors.jobId)}
                                                    helperText={resourceDraftErrors.jobId}
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <TextField
                                            label="Labor Category"
                                            fullWidth
                                            required
                                            value={resourceDraft.laborCategory}
                                            onChange={(event) => setResourceDraft((prev) => ({ ...prev, laborCategory: event.target.value }))}
                                            error={Boolean(resourceDraftErrors.laborCategory)}
                                            helperText={resourceDraftErrors.laborCategory}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <TextField
                                            label="Standard Hours"
                                            fullWidth
                                            value={resourceDraft.standardHours}
                                            onChange={(event) => setResourceDraft((prev) => ({ ...prev, standardHours: normalizeDecimalInput(event.target.value) }))}
                                            error={Boolean(resourceDraftErrors.standardHours)}
                                            helperText={resourceDraftErrors.standardHours || "Hours entered by the requestor for the labor line."}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <TextField
                                            label="Overtime Hours"
                                            fullWidth
                                            value={resourceDraft.overtimeHours}
                                            onChange={(event) => setResourceDraft((prev) => ({ ...prev, overtimeHours: normalizeDecimalInput(event.target.value) }))}
                                            error={Boolean(resourceDraftErrors.overtimeHours)}
                                            helperText={resourceDraftErrors.overtimeHours || "Optional overtime hours. HR/Admin will complete compensation later."}
                                        />
                                    </Grid>
                                </>
                            )}
                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    label="Comments"
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    value={resourceDraft.comments}
                                    onChange={(event) => setResourceDraft((prev) => ({ ...prev, comments: event.target.value }))}
                                />
                            </Grid>
                        </Grid>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeResourceDialog}>Cancel</Button>
                    <Button variant="contained" onClick={saveResourceDraft}>Save Resource</Button>
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
                                    value={travelDraft.lineType}
                                    onChange={(event) => setTravelDraft((prev) => ({ ...prev, lineType: event.target.value as TravelLineType }))}
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
                                    filterOptions={(options, state) => filterJobOptions(options, state.inputValue)}
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
                                    value={travelDraft.description}
                                    onChange={(event) => setTravelDraft((prev) => ({ ...prev, description: event.target.value }))}
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
        </Stack>
    );
};
