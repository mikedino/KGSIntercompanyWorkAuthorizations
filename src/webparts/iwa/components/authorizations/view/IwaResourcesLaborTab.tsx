import * as React from "react";
import { Alert, Box, Button, Chip, Grid, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import InputAdornment from "@mui/material/InputAdornment";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { ILaborLineItem, IModItem, IResourceItem } from "../../data/props";
import { formatCurrency, formatCurrencyInputValue, normalizeDecimalInput, parseNumberOrUndefined } from "../../common/utils";
import { resolveLaborCompensation } from "../../resources/laborMath";
import {
    compactCurrencyInputSx,
    compactNumberInputSx,
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

interface IIwaResourcesLaborTabProps {
    canEditCompInHrReview: boolean;
    canEditCompLine: (line: ILaborLineItem) => boolean;
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
    handleUpdateDraft: (lineId: number, patch: Partial<ICompDraft>) => void;
    isFfpAuthorization: boolean;
    laborDeltaTotal: number;
    laborLines: ILaborLineItem[];
    laborTotals: ILaborTotals;
    mayViewComp: boolean;
    mods: IModItem[];
    resourceRosterRows: IResourceRosterRow[];
    resources: IResourceItem[];
}

export const IwaResourcesLaborTab: React.FC<IIwaResourcesLaborTabProps> = ({
    canEditCompInHrReview,
    canEditCompLine,
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
    handleUpdateDraft,
    isFfpAuthorization,
    laborDeltaTotal,
    laborLines,
    laborTotals,
    mayViewComp,
    mods,
    resourceRosterRows,
    resources
}): JSX.Element => {
    const latestMod = React.useMemo(() => {
        return [...mods].sort((left, right) => {
            if ((right.modNumber ?? 0) !== (left.modNumber ?? 0)) {
                return (right.modNumber ?? 0) - (left.modNumber ?? 0);
            }

            return Date.parse(right.Created ?? "") - Date.parse(left.Created ?? "");
        })[0];
    }, [mods]);
    const latestModLabel = latestMod ? getModScopeLabel({ lineScope: "mod", mod: latestMod }) : "this Mod";
    const latestModId = latestMod?.Id;
    const [resourceScope, setResourceScope] = React.useState<"mod" | "all">("all");

    React.useEffect(() => {
        if (!latestModId) {
            setResourceScope("all");
        }
    }, [latestModId]);

    const visibleLaborLines = React.useMemo(() => {
        if (resourceScope !== "mod" || !latestModId) {
            return laborLines;
        }

        return laborLines.filter((line) => line.lineScope === "mod" && line.mod?.Id === latestModId);
    }, [laborLines, latestModId, resourceScope]);
    const visibleResourceRosterRows = React.useMemo(() => {
        if (resourceScope !== "mod" || !latestModId) {
            return resourceRosterRows;
        }

        return resourceRosterRows.filter((resource) => resource.labels.includes(latestModLabel));
    }, [latestModId, latestModLabel, resourceRosterRows, resourceScope]);
    const visibleLaborTotals = React.useMemo(() => {
        if (resourceScope !== "mod") {
            return laborTotals;
        }

        return visibleLaborLines.reduce((totals, line) => ({
            standardHours: totals.standardHours + Number(line.standardHours ?? 0),
            overtimeHours: totals.overtimeHours + Number(line.overtimeHours ?? 0),
            totalAmount: totals.totalAmount + Number(line.totalAmount ?? 0)
        }), { standardHours: 0, overtimeHours: 0, totalAmount: 0 });
    }, [laborTotals, resourceScope, visibleLaborLines]);
    const visibleLaborDeltaTotal = React.useMemo(() => {
        if (resourceScope !== "mod") {
            return laborDeltaTotal;
        }

        return visibleLaborLines.reduce((total, line) => total + Number(line.totalAmount ?? 0), 0);
    }, [laborDeltaTotal, resourceScope, visibleLaborLines]);

    return (
    <Stack spacing={2}>
        {!isFfpAuthorization && (
            <Stack spacing={1}>
                <Alert severity="info">
                    Only HR, current PM and Admins can view salary information. HR will add rates during the HR Review step.
                </Alert>
                {canEditCompInHrReview && (
                    <Alert severity="info">
                        Std rate is derived from salary / 2080 unless HR/Admin overrides the rate fields.
                    </Alert>
                )}
            </Stack>
        )}
        {latestModId && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between">
                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={resourceScope}
                    onChange={(_event, value: "mod" | "all" | null) => {
                        if (value) {
                            setResourceScope(value);
                        }
                    }}
                >
                    <ToggleButton value="mod">Show latest Mod</ToggleButton>
                    <ToggleButton value="all">Show all</ToggleButton>
                </ToggleButtonGroup>
                <Typography variant="caption" color="text.secondary">
                    {resourceScope === "mod"
                        ? `Only show the resources added or changed on ${latestModLabel}.`
                        : "Show all resources for all Mods."}
                </Typography>
            </Stack>
        )}
        <TableContainer>
            <Table size="small" sx={quietTableSx}>
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
                                <TableCell>Employee / Resource</TableCell>
                                <TableCell>State / Scope</TableCell>
                                <TableCell>Job ID</TableCell>
                                <TableCell>Labor Category</TableCell>
                                <TableCell align="right">Std Hrs</TableCell>
                                <TableCell align="right">OT Hrs</TableCell>
                                {mayViewComp && <TableCell align="right">Salary</TableCell>}
                                {mayViewComp && <TableCell align="right">Std Rate</TableCell>}
                                {mayViewComp && <TableCell align="right">OT Rate</TableCell>}
                            </>
                        )}
                        <TableCell align="right">{isFfpAuthorization ? "Total Amount" : "Total"}</TableCell>
                        {canEditCompInHrReview && !isFfpAuthorization && <TableCell align="right">Action</TableCell>}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {visibleLaborLines.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={isFfpAuthorization ? 6 : canEditCompInHrReview ? 11 : mayViewComp ? 10 : 7}>No labor lines found.</TableCell>
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
                                            <TableCell align="right">{formatCurrency(line.totalAmount)}</TableCell>
                                        </TableRow>
                                    );
                                }

                                const lineResource = resources.find((resource) => line.resources?.results?.some((lookup) => lookup.Id === resource.Id));
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
                                        <TableCell>{getResourceNamesForLabor(line, resources)}</TableCell>
                                        <TableCell>
                                            <Stack spacing={0.5} alignItems="flex-start">
                                                <Typography variant="body2">
                                                    {line.pricingType === "tm" ? lineResource?.state ?? "-" : "Multiple"}
                                                </Typography>
                                                <Chip
                                                    label={getModScopeLabel(line)}
                                                    size="small"
                                                    color={getModScopeChipColor(line)}
                                                    variant="outlined"
                                                />
                                            </Stack>
                                        </TableCell>
                                        <TableCell>{line.jobId || "-"}</TableCell>
                                        <TableCell>{lineResource?.laborCategory || "-"}</TableCell>
                                        <TableCell align="right">
                                            {isEditingComp ? (
                                                <TextField size="small" value={draft.standardHours} onChange={(event) => handleUpdateDraft(line.Id, { standardHours: normalizeDecimalInput(event.target.value) })} sx={compactNumberInputSx} />
                                            ) : line.standardHours ?? "-"}
                                        </TableCell>
                                        <TableCell align="right">
                                            {isEditingComp ? (
                                                <TextField size="small" value={draft.overtimeHours} onChange={(event) => handleUpdateDraft(line.Id, { overtimeHours: normalizeDecimalInput(event.target.value) })} sx={compactNumberInputSx} />
                                            ) : line.overtimeHours ?? "-"}
                                        </TableCell>
                                        {mayViewComp && (
                                            <TableCell align="right">
                                                {isEditingComp ? (
                                                    <TextField
                                                        size="small"
                                                        value={draft.annualSalary}
                                                        onChange={(event) => handleAnnualSalaryChange(line.Id, event.target.value)}
                                                        onBlur={() => handleCurrencyDraftBlur(line.Id, "annualSalary")}
                                                        sx={compactCurrencyInputSx}
                                                        slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                                                    />
                                                ) : formatCurrency(line.annualSalary)}
                                            </TableCell>
                                        )}
                                        {mayViewComp && (
                                            <TableCell align="right">
                                                {isEditingComp ? (
                                                    <TextField
                                                        size="small"
                                                        value={draft.standardRate || formatCurrencyInputValue(preview.standardRate)}
                                                        onChange={(event) => handleStandardRateChange(line.Id, event.target.value)}
                                                        onBlur={() => handleCurrencyDraftBlur(line.Id, "standardRate")}
                                                        sx={compactCurrencyInputSx}
                                                        slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                                                    />
                                                ) : formatCurrency(line.standardRate)}
                                            </TableCell>
                                        )}
                                        {mayViewComp && (
                                            <TableCell align="right">
                                                {isEditingComp ? (
                                                    <TextField
                                                        size="small"
                                                        value={draft.overtimeRate || formatCurrencyInputValue(preview.overtimeRate)}
                                                        onChange={(event) => handleOvertimeRateChange(line.Id, event.target.value)}
                                                        onBlur={() => handleCurrencyDraftBlur(line.Id, "overtimeRate")}
                                                        sx={compactCurrencyInputSx}
                                                        slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                                                    />
                                                ) : formatCurrency(line.overtimeRate)}
                                            </TableCell>
                                        )}
                                        <TableCell align="right">{formatCurrency(isEditingComp ? preview.totalAmount : line.totalAmount)}</TableCell>
                                        {canEditCompInHrReview && (
                                            <TableCell align="right">
                                                {isEditingComp ? (
                                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                        <Tooltip title="Recalculate rates from salary">
                                                            <Button size="small" startIcon={<CalculateOutlinedIcon />} onClick={() => handleRecalculateCompRates(line.Id)}>
                                                                Recalc
                                                            </Button>
                                                        </Tooltip>
                                                        <Button size="small" startIcon={<SaveOutlinedIcon />} onClick={() => handleSaveComp(line)}>
                                                            Save
                                                        </Button>
                                                        <Button size="small" onClick={() => handleCancelCompEdit(line)}>
                                                            Cancel
                                                        </Button>
                                                    </Stack>
                                                ) : canEditThisLine ? (
                                                    <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => handleStartCompEdit(line)}>
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
                                    <TableCell colSpan={isFfpAuthorization ? 5 : 4}>Totals</TableCell>
                                    {!isFfpAuthorization && <TableCell align="right">{visibleLaborTotals.standardHours || "-"}</TableCell>}
                                    {!isFfpAuthorization && <TableCell align="right">{visibleLaborTotals.overtimeHours || "-"}</TableCell>}
                                    {!isFfpAuthorization && mayViewComp && <TableCell />}
                                    {!isFfpAuthorization && mayViewComp && <TableCell />}
                                    {!isFfpAuthorization && mayViewComp && <TableCell />}
                                    <TableCell align="right">
                                        <Stack spacing={0.25} alignItems="flex-end">
                                            <Typography variant="body2" fontWeight={600}>{formatCurrency(visibleLaborTotals.totalAmount)}</Typography>
                                            {visibleLaborDeltaTotal !== 0 && (
                                                <Typography variant="caption" color={visibleLaborDeltaTotal > 0 ? "success.main" : "error.main"}>
                                                    {visibleLaborDeltaTotal > 0 ? "+" : ""}{formatCurrency(visibleLaborDeltaTotal)} mod
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
                        <Typography variant="body2" color="text.secondary">No resources were added or changed on {latestModLabel}.</Typography>
                    </Grid>
                )}
            </Grid>
        </Box>
    </Stack>
    );
};
