import * as React from "react";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Chip, Divider, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import { ILaborLineItem, IModItem, IResourceItem, ITravelOdcItem } from "../../data/props";
import { formatCurrency, formatDate } from "../../common/utils";
import { quietTableSx, totalsRowSx } from "./iwaViewUtils";

interface IModLaborSummaryRow {
    key: string;
    employeeName: string;
    state: string;
    jobId: string;
    laborCategory: string;
    standardHours: number;
    overtimeHours: number;
    totalHours: number;
    totalAmount: number;
    changeType: "addedPerson" | "addedHours";
}

interface IModTravelSummaryRow {
    key: string;
    lineType: string;
    jobId: string;
    description: string;
    amount: number;
}

interface IIwaModsTabProps {
    laborLines: ILaborLineItem[];
    mods: IModItem[];
    resources: IResourceItem[];
    travelOdcs: ITravelOdcItem[];
}

const modStatusLabels: Record<IModItem["modStatus"], string> = {
    draft: "Draft",
    submitted: "Submitted",
    underReview: "Under Review",
    approved: "Approved",
    rejected: "Rejected",
    canceled: "Canceled"
};

const getModStatusChipColor = (status: IModItem["modStatus"]): "default" | "info" | "success" | "warning" | "error" => {
    if (status === "approved") {
        return "success";
    }

    if (status === "rejected" || status === "canceled") {
        return "error";
    }

    if (status === "submitted" || status === "underReview") {
        return "info";
    }

    if (status === "draft") {
        return "warning";
    }

    return "default";
};

const getModLabel = (mod: IModItem): string => `Mod ${mod.modNumber ?? "-"}`;

const getResourceForLabor = (line: ILaborLineItem, resources: IResourceItem[]): IResourceItem | undefined => {
    const resourceIds = line.resources?.results?.map((resource) => resource.Id) ?? [];
    return resources.find((resource) => resourceIds.includes(resource.Id));
};

const getEmployeeBaseKey = (resource: IResourceItem | undefined, line: ILaborLineItem): string => {
    if (resource?.employee?.Id) {
        return `employee:${resource.employee.Id}`;
    }

    return `job:${line.jobId || ""}:category:${resource?.laborCategory || ""}:state:${resource?.state || ""}`;
};

const buildLaborRows = (mod: IModItem, resources: IResourceItem[], laborLines: ILaborLineItem[]): IModLaborSummaryRow[] => {
    const activeBaseEmployeeKeys = new Set(
        resources
            .filter((resource) => resource.isActive !== false && resource.lineScope !== "mod")
            .map((resource) => getEmployeeBaseKey(resource, {} as ILaborLineItem))
    );

    return laborLines
        .filter((line) => line.isActive !== false && line.lineScope === "mod" && line.mod?.Id === mod.Id)
        .map((line) => {
            const resource = getResourceForLabor(line, resources);
            const employeeKey = getEmployeeBaseKey(resource, line);
            const standardHours = Number(line.standardHours ?? 0);
            const overtimeHours = Number(line.overtimeHours ?? 0);
            const changeType: IModLaborSummaryRow["changeType"] = activeBaseEmployeeKeys.has(employeeKey) ? "addedHours" : "addedPerson";

            return {
                key: `${mod.Id}-${line.Id}`,
                employeeName: resource?.employee?.Title ?? "Resource not linked",
                state: resource?.state || "-",
                jobId: line.jobId || "-",
                laborCategory: resource?.laborCategory || "-",
                standardHours,
                overtimeHours,
                totalHours: standardHours + overtimeHours,
                totalAmount: Number(line.totalAmount ?? 0),
                changeType
            };
        })
        .sort((left, right) => left.employeeName.localeCompare(right.employeeName, undefined, { sensitivity: "base" }) || left.jobId.localeCompare(right.jobId));
};

const buildTravelRows = (mod: IModItem, travelOdcs: ITravelOdcItem[]): IModTravelSummaryRow[] => (
    travelOdcs
        .filter((line) => line.isActive !== false && line.lineScope === "mod" && line.mod?.Id === mod.Id)
        .map((line) => ({
            key: `${mod.Id}-${line.Id}`,
            lineType: line.lineType.toUpperCase(),
            jobId: line.jobId || "-",
            description: line.description || "-",
            amount: Number(line.amount ?? 0)
        }))
        .sort((left, right) => left.lineType.localeCompare(right.lineType) || left.jobId.localeCompare(right.jobId))
);

const sum = <T,>(items: T[], selector: (item: T) => number): number => items.reduce((total, item) => total + selector(item), 0);

export const IwaModsTab: React.FC<IIwaModsTabProps> = ({
    laborLines,
    mods,
    resources,
    travelOdcs
}): JSX.Element => {
    const orderedMods = React.useMemo(() => {
        return [...mods].sort((left, right) => {
            if ((right.modNumber ?? 0) !== (left.modNumber ?? 0)) {
                return (right.modNumber ?? 0) - (left.modNumber ?? 0);
            }

            return Date.parse(right.Created ?? "") - Date.parse(left.Created ?? "");
        });
    }, [mods]);

    const [expandedModId, setExpandedModId] = React.useState<number | false>(false);

    React.useEffect(() => {
        setExpandedModId((current) => {
            if (current && orderedMods.some((mod) => mod.Id === current)) {
                return current;
            }

            return orderedMods[0]?.Id ?? false;
        });
    }, [orderedMods]);

    if (orderedMods.length === 0) {
        return <Typography color="text.secondary">No mods found for this authorization.</Typography>;
    }

    return (
        <Stack spacing={2}>
            {orderedMods.map((mod) => {
                const laborRows = buildLaborRows(mod, resources, laborLines);
                const travelRows = buildTravelRows(mod, travelOdcs);
                const standardHoursTotal = sum(laborRows, (row) => row.standardHours);
                const overtimeHoursTotal = sum(laborRows, (row) => row.overtimeHours);
                const laborHoursTotal = sum(laborRows, (row) => row.totalHours);
                const laborCostTotal = sum(laborRows, (row) => row.totalAmount);
                const travelCostTotal = sum(travelRows, (row) => row.amount);
                const grandDelta = laborCostTotal + travelCostTotal;

                return (
                    <Accordion
                        key={mod.Id}
                        expanded={expandedModId === mod.Id}
                        onChange={(_event, expanded) => setExpandedModId(expanded ? mod.Id : false)}
                        disableGutters
                        sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: "8px !important",
                            bgcolor: "background.paper",
                            "&:before": { display: "none" }
                        }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreOutlinedIcon />}>
                            <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between" sx={{ width: "100%", pr: 1 }}>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                                    <Typography variant="h6" fontWeight={700}>{getModLabel(mod)}</Typography>
                                    <Chip label={modStatusLabels[mod.modStatus]} color={getModStatusChipColor(mod.modStatus)} size="small" />
                                    <Chip label={`${laborRows.length} labor change${laborRows.length === 1 ? "" : "s"}`} size="small" variant="outlined" />
                                    <Chip label={`${travelRows.length} travel / ODC change${travelRows.length === 1 ? "" : "s"}`} size="small" variant="outlined" />
                                </Stack>
                                <Stack spacing={0.25} alignItems={{ xs: "flex-start", md: "flex-end" }}>
                                    <Typography variant="body2" fontWeight={600}>{formatCurrency(grandDelta)} total change</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {mod.Created ? `Created ${formatDate(mod.Created, true)}` : "Created date unavailable"}
                                    </Typography>
                                </Stack>
                            </Stack>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0 }}>
                            <Stack spacing={2}>
                                <Paper variant="outlined" sx={{ p: 1.75 }}>
                                    <Stack spacing={1}>
                                        <Typography variant="subtitle2" fontWeight={700}>Why this Mod was created</Typography>
                                        <Typography color="text.secondary">{mod.reason || mod.changeSummary || "No reason was entered for this Mod."}</Typography>
                                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
                                            <Chip label={`Created by ${mod.Author?.Title ?? "Unknown"}`} size="small" variant="outlined" />
                                            <Chip label={`Labor ${formatCurrency(laborCostTotal)}`} size="small" variant="outlined" />
                                            <Chip label={`Travel / ODC ${formatCurrency(travelCostTotal)}`} size="small" variant="outlined" />
                                        </Stack>
                                    </Stack>
                                </Paper>

                                <Alert severity="info">
                                    No date extension is captured on this Mod record. This section will show period changes after the Mod stores the extended dates.
                                </Alert>

                                <Box>
                                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Labor and Resources</Typography>
                                    {laborRows.length === 0 ? (
                                        <Typography color="text.secondary">No resource or labor changes were added on this Mod.</Typography>
                                    ) : (
                                        <TableContainer>
                                            <Table size="small" sx={quietTableSx}>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>What changed</TableCell>
                                                        <TableCell>Employee / Resource</TableCell>
                                                        <TableCell>Job ID</TableCell>
                                                        <TableCell>Labor Category</TableCell>
                                                        <TableCell align="right">Std Hrs</TableCell>
                                                        <TableCell align="right">OT Hrs</TableCell>
                                                        <TableCell align="right">Total Hrs</TableCell>
                                                        <TableCell align="right">Cost Change</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {laborRows.map((row) => (
                                                        <TableRow key={row.key} hover>
                                                            <TableCell>
                                                                <Chip
                                                                    label={row.changeType === "addedPerson" ? "Added resource" : "Added hours"}
                                                                    size="small"
                                                                    color={row.changeType === "addedPerson" ? "secondary" : "info"}
                                                                    variant="outlined"
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                <Stack spacing={0.15}>
                                                                    <Typography variant="body2" fontWeight={600}>{row.employeeName}</Typography>
                                                                    <Typography variant="caption" color="text.secondary">{row.state}</Typography>
                                                                </Stack>
                                                            </TableCell>
                                                            <TableCell>{row.jobId}</TableCell>
                                                            <TableCell>{row.laborCategory}</TableCell>
                                                            <TableCell align="right">{row.standardHours || "-"}</TableCell>
                                                            <TableCell align="right">{row.overtimeHours || "-"}</TableCell>
                                                            <TableCell align="right">+{row.totalHours}</TableCell>
                                                            <TableCell align="right">+{formatCurrency(row.totalAmount)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    <TableRow sx={totalsRowSx}>
                                                        <TableCell colSpan={4}>Total labor change</TableCell>
                                                        <TableCell align="right">{standardHoursTotal || "-"}</TableCell>
                                                        <TableCell align="right">{overtimeHoursTotal || "-"}</TableCell>
                                                        <TableCell align="right">+{laborHoursTotal}</TableCell>
                                                        <TableCell align="right">+{formatCurrency(laborCostTotal)}</TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    )}
                                </Box>

                                <Divider />

                                <Box>
                                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Travel / ODC</Typography>
                                    {travelRows.length === 0 ? (
                                        <Typography color="text.secondary">No travel or ODC changes were added on this Mod.</Typography>
                                    ) : (
                                        <TableContainer>
                                            <Table size="small" sx={quietTableSx}>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>What changed</TableCell>
                                                        <TableCell>Job ID</TableCell>
                                                        <TableCell>Description</TableCell>
                                                        <TableCell align="right">Cost Change</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {travelRows.map((row) => (
                                                        <TableRow key={row.key} hover>
                                                            <TableCell><Chip label={`Added ${row.lineType}`} size="small" color="info" variant="outlined" /></TableCell>
                                                            <TableCell>{row.jobId}</TableCell>
                                                            <TableCell>{row.description}</TableCell>
                                                            <TableCell align="right">+{formatCurrency(row.amount)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    <TableRow sx={totalsRowSx}>
                                                        <TableCell colSpan={3}>Total travel / ODC change</TableCell>
                                                        <TableCell align="right">+{formatCurrency(travelCostTotal)}</TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    )}
                                </Box>
                            </Stack>
                        </AccordionDetails>
                    </Accordion>
                );
            })}
        </Stack>
    );
};
