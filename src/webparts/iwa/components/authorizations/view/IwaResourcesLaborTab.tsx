import * as React from "react";
import { Alert, Box, Button, Chip, Grid, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import InputAdornment from "@mui/material/InputAdornment";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { ILaborLineItem, IModItem, IResourceItem } from "../../data/props";
import { formatCurrency, parseNumberOrUndefined } from "../../common/utils";
import { maskedCurrencyText } from "../financialAccess";
import { resolveLaborCompensation } from "../../resources/laborMath";
import {
    compactCurrencyInputSx,
    formatModLabel,
    getModScopeChipColor,
    getModScopeLabel,
    getResourceNamesForLabor,
    ICompDraft,
    IResourceRosterRow,
    quietTableSx,
    toCompDraft,
    totalsRowSx
} from "./iwaViewUtils";

interface ILaborTotals {
    overtimeHours: number;
    standardHours: number;
    totalAmount: number;
}

type ResourceScopeFilter = "all" | "base" | `mod-${number}`;

const resourcesLaborTableSx = {
    ...quietTableSx,
    "& .resourcesLaborScopeCell": { minWidth: 72, width: 72 },
    "& .resourcesLaborEmployeeCell": { minWidth: 190, width: 190 },
    "& .resourcesLaborStateCell": { minWidth: 52, width: 52 },
    "& .resourcesLaborJobCell": { minWidth: 172, width: 172 },
    "& .resourcesLaborCategoryCell": { minWidth: 140, width: 140 },
    "& .resourcesLaborHoursCell": { minWidth: 56, width: 56 },
    "& .resourcesLaborStoCell": { minWidth: 42, width: 42 },
    "& .resourcesLaborSalaryCell": { minWidth: 88, width: 88 },
    "& .resourcesLaborRateCell": { minWidth: 70, width: 70 },
    "& .resourcesLaborTotalCell": { minWidth: 106, width: 106 }
};

const compactRateInputSx = {
    ...compactCurrencyInputSx,
    width: 88
};

const getStateAbbreviation = (state?: string): string => {
    const trimmed = state?.trim();

    if (!trimmed) {
        return "-";
    }

    const match = trimmed.match(/\(([A-Z]{2})\)$/);
    return match?.[1] ?? trimmed;
};

interface IIwaResourcesLaborTabProps {
    canEditCompInHrReview: boolean;
    canEditCompLine: (line: ILaborLineItem) => boolean;
    canViewFinancials: boolean;
    compDrafts: Record<number, ICompDraft>;
    editingCompLineIds: Record<number, boolean>;
    handleAnnualSalaryChange: (lineId: number, value: string) => void;
    handleCancelCompEdit: (line: ILaborLineItem) => void;
    handleCurrencyDraftBlur: (lineId: number, field: "annualSalary" | "standardRate" | "overtimeRate") => void;
    handleOvertimeRateChange: (lineId: number, value: string) => void;
    handleRecalculateCompRates: (lineId: number) => void;
    handleSaveComp: (line: ILaborLineItem) => void;
    handleStandardRateChange: (lineId: number, value: string) => void;
    handleStartCompEdit: (line: ILaborLineItem) => void;
    onOpenCommentDialog: (dialog: { title: string; comments: string }) => void;
    isFfpAuthorization: boolean;
    laborDeltaTotal: number;
    laborLines: ILaborLineItem[];
    laborTotals: ILaborTotals;
    mods: IModItem[];
    resourceRosterRows: IResourceRosterRow[];
    resources: IResourceItem[];
}

export const IwaResourcesLaborTab: React.FC<IIwaResourcesLaborTabProps> = ({
    canEditCompInHrReview,
    canEditCompLine,
    canViewFinancials,
    compDrafts,
    editingCompLineIds,
    handleAnnualSalaryChange,
    handleCancelCompEdit,
    handleCurrencyDraftBlur,
    handleOvertimeRateChange,
    handleRecalculateCompRates,
    handleSaveComp,
    handleStandardRateChange,
    handleStartCompEdit,
    onOpenCommentDialog,
    isFfpAuthorization,
    laborDeltaTotal,
    laborLines,
    laborTotals,
    mods,
    resourceRosterRows,
    resources
}): JSX.Element => {
    const modFilterOptions = React.useMemo(() => {
        return [...mods]
            .sort((left, right) => {
                if ((left.modNumber ?? 0) !== (right.modNumber ?? 0)) {
                    return (left.modNumber ?? 0) - (right.modNumber ?? 0);
                }

                return Date.parse(left.Created ?? "") - Date.parse(right.Created ?? "");
            })
            .map((mod) => ({
                id: mod.Id,
                label: formatModLabel(mod.modNumber),
                value: `mod-${mod.Id}` as ResourceScopeFilter
            }));
    }, [mods]);
    const [resourceScope, setResourceScope] = React.useState<ResourceScopeFilter>("all");

    React.useEffect(() => {
        if (resourceScope === "all" || resourceScope === "base") {
            return;
        }

        const modId = Number(resourceScope.replace("mod-", ""));
        const modExists = modFilterOptions.some((option) => option.id === modId);

        if (!modExists) {
            setResourceScope("all");
        }
    }, [modFilterOptions, resourceScope]);

    const visibleLaborLines = React.useMemo(() => {
        if (resourceScope === "all") {
            return laborLines;
        }

        if (resourceScope === "base") {
            return laborLines.filter((line) => line.lineScope !== "mod");
        }

        const modId = Number(resourceScope.replace("mod-", ""));
        return laborLines.filter((line) => line.lineScope === "mod" && line.mod?.Id === modId);
    }, [laborLines, resourceScope]);
    const visibleResourceRosterRows = React.useMemo(() => {
        if (resourceScope === "all") {
            return resourceRosterRows;
        }

        const label = resourceScope === "base"
            ? "BASE"
            : modFilterOptions.find((option) => option.value === resourceScope)?.label;

        return label
            ? resourceRosterRows.filter((resource) => resource.labels.includes(label))
            : resourceRosterRows;
    }, [modFilterOptions, resourceRosterRows, resourceScope]);
    const visibleLaborTotals = React.useMemo(() => {
        if (resourceScope === "all") {
            return laborTotals;
        }

        return visibleLaborLines.reduce((totals, line) => ({
            standardHours: totals.standardHours + Number(line.standardHours ?? 0),
            overtimeHours: totals.overtimeHours + Number(line.overtimeHours ?? 0),
            totalAmount: totals.totalAmount + Number(line.totalAmount ?? 0)
        }), { standardHours: 0, overtimeHours: 0, totalAmount: 0 });
    }, [laborTotals, resourceScope, visibleLaborLines]);
    const visibleLaborDeltaTotal = React.useMemo(() => {
        if (resourceScope === "all") {
            return laborDeltaTotal;
        }

        return visibleLaborLines.reduce((total, line) => total + Number(line.totalAmount ?? 0), 0);
    }, [laborDeltaTotal, resourceScope, visibleLaborLines]);
    const selectedScopeLabel = resourceScope === "all"
        ? "all resources for all Mods"
        : resourceScope === "base"
            ? "only the original BASE resources"
            : `only the resources added or changed on ${modFilterOptions.find((option) => option.value === resourceScope)?.label ?? "this Mod"}`;

    return (
    <Stack spacing={2}>
        {!isFfpAuthorization && (
            <Stack spacing={1}>
                <Alert severity="info">
                    Dollar amounts are visible to workflow approvers, their backups, and the PM. HR will add rates during the HR Review step.
                </Alert>
                {canEditCompInHrReview && (
                    <Alert severity="info">
                        Std rate is derived from salary / 2080 x 1.65 unless HR/Admin overrides the rate fields.
                    </Alert>
                )}
            </Stack>
        )}
        {modFilterOptions.length > 0 && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between">
                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={resourceScope}
                    onChange={(_event, value: ResourceScopeFilter | null) => {
                        if (value) {
                            setResourceScope(value);
                        }
                    }}
                    sx={{ flexWrap: "wrap", gap: 0.5, "& .MuiToggleButtonGroup-grouped": { borderRadius: 1, borderLeft: "1px solid", borderColor: "divider" } }}
                >
                    <ToggleButton value="all">All</ToggleButton>
                    <ToggleButton value="base">BASE</ToggleButton>
                    {modFilterOptions.map((option) => (
                        <ToggleButton key={option.value} value={option.value}>{option.label}</ToggleButton>
                    ))}
                </ToggleButtonGroup>
                <Typography variant="caption" color="text.secondary">
                    Showing {selectedScopeLabel}.
                </Typography>
            </Stack>
        )}
        <TableContainer>
            <Table size="small" sx={isFfpAuthorization ? quietTableSx : resourcesLaborTableSx}>
                <TableHead>
                    <TableRow>
                        {isFfpAuthorization ? (
                            <>
                                <TableCell>Job ID</TableCell>
                                <TableCell>Scope</TableCell>
                                <TableCell>Charging Period</TableCell>
                                <TableCell align="right">Periods</TableCell>
                                <TableCell>Resources</TableCell>
                            </>
                        ) : (
                            <>
                                <TableCell className="resourcesLaborScopeCell">Scope</TableCell>
                                <TableCell className="resourcesLaborEmployeeCell">Employee / Resource</TableCell>
                                <TableCell className="resourcesLaborStateCell">State</TableCell>
                                <TableCell className="resourcesLaborJobCell">Job ID</TableCell>
                                <TableCell className="resourcesLaborCategoryCell">Labor Category</TableCell>
                                <TableCell className="resourcesLaborHoursCell" align="right">Std Hrs</TableCell>
                                <TableCell className="resourcesLaborStoCell" align="center">STO</TableCell>
                                <TableCell className="resourcesLaborHoursCell" align="right">OT Hrs</TableCell>
                                <TableCell className="resourcesLaborSalaryCell" align="right">Salary</TableCell>
                                <TableCell className="resourcesLaborRateCell" align="right">Std Rate</TableCell>
                                <TableCell className="resourcesLaborRateCell" align="right">OT Rate</TableCell>
                            </>
                        )}
                        <TableCell className={isFfpAuthorization ? undefined : "resourcesLaborTotalCell"} align="right">{isFfpAuthorization ? "Total Amount" : "Total"}</TableCell>
                        {canEditCompInHrReview && !isFfpAuthorization && <TableCell align="right">Action</TableCell>}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {visibleLaborLines.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={isFfpAuthorization ? 6 : canEditCompInHrReview ? 13 : 12}>No labor lines found.</TableCell>
                        </TableRow>
                    ) : (
                        <>
                            {visibleLaborLines.map((line) => {
                                if (isFfpAuthorization) {
                                    return (
                                        <TableRow key={line.Id} hover>
                                            <TableCell>{line.jobId || "-"}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={getModScopeLabel(line)}
                                                    size="small"
                                                    color={getModScopeChipColor(line)}
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>{line.chargingPeriod || "-"}</TableCell>
                                            <TableCell align="right">{line.periodQty ?? "-"}</TableCell>
                                            <TableCell>{getResourceNamesForLabor(line, resources)}</TableCell>
                                            <TableCell align="right">{canViewFinancials ? formatCurrency(line.totalAmount) : maskedCurrencyText}</TableCell>
                                        </TableRow>
                                    );
                                }

                                const lineResource = resources.find((resource) => line.resources?.results?.some((lookup) => lookup.Id === resource.Id));
                                const resourceComments = (lineResource?.comments ?? "").trim();
                                const draft = compDrafts[line.Id] ?? toCompDraft(line);
                                const canEditThisLine = canEditCompLine(line);
                                const isEditingComp = canEditThisLine && !!editingCompLineIds[line.Id];
                                const preview = resolveLaborCompensation({
                                    annualSalary: parseNumberOrUndefined(draft.annualSalary),
                                    standardRate: parseNumberOrUndefined(draft.standardRate),
                                    overtimeRate: parseNumberOrUndefined(draft.overtimeRate),
                                    standardHours: parseNumberOrUndefined(draft.standardHours),
                                    overtimeHours: parseNumberOrUndefined(draft.overtimeHours)
                                });

                                return (
                                    <TableRow key={line.Id} hover>
                                        <TableCell className="resourcesLaborScopeCell">
                                            <Chip
                                                label={getModScopeLabel(line)}
                                                size="small"
                                                color={getModScopeChipColor(line)}
                                                variant="outlined"
                                            />
                                        </TableCell>
                                        <TableCell className="resourcesLaborEmployeeCell">
                                            <Stack direction="row" spacing={0.5} alignItems="center">
                                                <Typography variant="body2">{getResourceNamesForLabor(line, resources)}</Typography>
                                                {!!resourceComments && (
                                                    <Tooltip title="View resource comments">
                                                        <IconButton
                                                            size="small"
                                                            color="info"
                                                            aria-label={`View comments for ${getResourceNamesForLabor(line, resources)}`}
                                                            title={`View comments for ${getResourceNamesForLabor(line, resources)}`}
                                                            onClick={() => onOpenCommentDialog({
                                                                title: `${getResourceNamesForLabor(line, resources)} Comments`,
                                                                comments: resourceComments
                                                            })}
                                                        >
                                                            <ChatBubbleOutlineOutlinedIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Stack>
                                        </TableCell>
                                        <TableCell className="resourcesLaborStateCell">
                                            {line.pricingType === "tm" ? getStateAbbreviation(lineResource?.state) : "Multi"}
                                        </TableCell>
                                        <TableCell className="resourcesLaborJobCell">{line.jobId || "-"}</TableCell>
                                        <TableCell className="resourcesLaborCategoryCell">{lineResource?.laborCategory || "-"}</TableCell>
                                        <TableCell className="resourcesLaborHoursCell" align="right">{line.standardHours ?? "-"}</TableCell>
                                        <TableCell className="resourcesLaborStoCell" align="center">
                                            {line.stoHours ? <CheckOutlinedIcon color="success" fontSize="small" /> : "-"}
                                        </TableCell>
                                        <TableCell className="resourcesLaborHoursCell" align="right">{line.overtimeHours ?? "-"}</TableCell>
                                        <TableCell className="resourcesLaborSalaryCell" align="right">
                                            {isEditingComp ? (
                                                    <TextField
                                                        size="small"
                                                        value={draft.annualSalary}
                                                        onChange={(event) => handleAnnualSalaryChange(line.Id, event.target.value)}
                                                        onBlur={() => handleCurrencyDraftBlur(line.Id, "annualSalary")}
                                                        sx={compactCurrencyInputSx}
                                                        slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                                                    />
                                            ) : canViewFinancials ? formatCurrency(line.annualSalary) : maskedCurrencyText}
                                        </TableCell>
                                        <TableCell className="resourcesLaborRateCell" align="right">
                                            {isEditingComp ? (
                                                    <TextField
                                                        size="small"
                                                        value={draft.standardRate}
                                                        onChange={(event) => handleStandardRateChange(line.Id, event.target.value)}
                                                        onBlur={() => handleCurrencyDraftBlur(line.Id, "standardRate")}
                                                        sx={compactRateInputSx}
                                                        slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                                                    />
                                            ) : canViewFinancials ? formatCurrency(line.standardRate) : maskedCurrencyText}
                                        </TableCell>
                                        <TableCell className="resourcesLaborRateCell" align="right">
                                            {isEditingComp ? (
                                                    <TextField
                                                        size="small"
                                                        value={draft.overtimeRate}
                                                        onChange={(event) => handleOvertimeRateChange(line.Id, event.target.value)}
                                                        onBlur={() => handleCurrencyDraftBlur(line.Id, "overtimeRate")}
                                                        sx={compactRateInputSx}
                                                        slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                                                    />
                                            ) : canViewFinancials ? formatCurrency(line.overtimeRate) : maskedCurrencyText}
                                        </TableCell>
                                        <TableCell className="resourcesLaborTotalCell" align="right">{canViewFinancials ? formatCurrency(isEditingComp ? preview.totalAmount : line.totalAmount) : maskedCurrencyText}</TableCell>
                                        {canEditCompInHrReview && (
                                            <TableCell align="right">
                                                {isEditingComp ? (
                                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                        <Tooltip title="Recalculate rates from salary">
                                                            <Button size="small" startIcon={<CalculateOutlinedIcon />} onClick={() => handleRecalculateCompRates(line.Id)} aria-label="Recalculate compensation rates" title="Recalculate compensation rates">
                                                                Recalc
                                                            </Button>
                                                        </Tooltip>
                                                        <Button size="small" startIcon={<SaveOutlinedIcon />} onClick={() => handleSaveComp(line)} aria-label="Save compensation rates" title="Save compensation rates">
                                                            Save
                                                        </Button>
                                                        <Button size="small" onClick={() => handleCancelCompEdit(line)} aria-label="Cancel compensation edits" title="Cancel compensation edits">
                                                            Cancel
                                                        </Button>
                                                    </Stack>
                                                ) : canEditThisLine ? (
                                                    <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => handleStartCompEdit(line)} aria-label="Edit compensation rates" title="Edit compensation rates">
                                                        Edit
                                                    </Button>
                                                ) : (
                                                    <Typography variant="caption" color="text.secondary">
                                                        Locked
                                                    </Typography>
                                                )}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            })}
                            {visibleLaborLines.length > 1 && (
                                <TableRow sx={totalsRowSx}>
                                    <TableCell colSpan={isFfpAuthorization ? 5 : 5}>Totals</TableCell>
                                    {!isFfpAuthorization && <TableCell className="resourcesLaborHoursCell" align="right">{visibleLaborTotals.standardHours || "-"}</TableCell>}
                                    {!isFfpAuthorization && <TableCell className="resourcesLaborStoCell" align="center">-</TableCell>}
                                    {!isFfpAuthorization && <TableCell className="resourcesLaborHoursCell" align="right">{visibleLaborTotals.overtimeHours || "-"}</TableCell>}
                                    {!isFfpAuthorization && <TableCell />}
                                    {!isFfpAuthorization && <TableCell />}
                                    {!isFfpAuthorization && <TableCell />}
                                    <TableCell className={isFfpAuthorization ? undefined : "resourcesLaborTotalCell"} align="right">
                                        <Stack spacing={0.25} alignItems="flex-end">
                                            <Typography variant="body2" fontWeight={600}>{canViewFinancials ? formatCurrency(visibleLaborTotals.totalAmount) : maskedCurrencyText}</Typography>
                                            {visibleLaborDeltaTotal !== 0 && (
                                                <Typography variant="caption" color={visibleLaborDeltaTotal > 0 ? "success.main" : "error.main"}>
                                                    {canViewFinancials ? `${visibleLaborDeltaTotal > 0 ? "+" : ""}${formatCurrency(visibleLaborDeltaTotal)}` : maskedCurrencyText} mod
                                                </Typography>
                                            )}
                                        </Stack>
                                    </TableCell>
                                    {!isFfpAuthorization && canEditCompInHrReview && <TableCell />}
                                </TableRow>
                            )}
                        </>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
        <Box>
            <Typography variant="subtitle2" fontWeight={600}>Resource Roster</Typography>
            <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                {visibleResourceRosterRows.map((resource) => (
                    <Grid key={resource.key} size={{ xs: 12, md: 6, xl: 4 }}>
                        <Paper sx={{ p: 1.5, height: "100%" }}>
                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                <Typography fontWeight={600}>{resource.title}</Typography>
                                <Stack direction="row" spacing={0.5}>
                                    {resource.labels.map((label) => (
                                        <Chip
                                            key={label}
                                            label={label}
                                            size="small"
                                            color={label === "BASE" ? "default" : "secondary"}
                                            variant="outlined"
                                        />
                                    ))}
                                </Stack>
                            </Stack>
                            <Typography variant="body2" color="text.secondary">{resource.email}</Typography>
                        </Paper>
                    </Grid>
                ))}
                {visibleResourceRosterRows.length === 0 && (
                    <Grid size={{ xs: 12 }}>
                        <Typography variant="body2" color="text.secondary">No resources found for the selected filter.</Typography>
                    </Grid>
                )}
            </Grid>
        </Box>
    </Stack>
    );
};
