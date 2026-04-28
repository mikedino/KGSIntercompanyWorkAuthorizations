import * as React from "react";
import { Divider, Grid, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { Dayjs } from "dayjs";
import { ContractType, IAuthorizationItem, IInvoiceItem, IJobItem } from "../data/props";
import { formatCurrency, RELATIONSHIP_SEPARATOR } from "../common/utils";
import { IFfpLaborConfig, IEditableResourceRow, IEditableTravelRow } from "./IwaWorkPackageStep";

export interface IIwaReviewSectionProps {
    attachmentsCount: number;
    form: IAuthorizationItem;
    ffpLaborConfig: IFfpLaborConfig;
    jobs: IJobItem[];
    periodEnd?: Dayjs;
    periodStart?: Dayjs;
    resourceRows: IEditableResourceRow[];
    selectedContractType: { value: ContractType; label: string; helperText: string; };
    selectedInvoice?: IInvoiceItem;
    travelRows: IEditableTravelRow[];
}

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

export const IwaReviewSection: React.FC<IIwaReviewSectionProps> = ({
    attachmentsCount,
    ffpLaborConfig,
    form,
    jobs,
    periodEnd,
    periodStart,
    resourceRows,
    selectedContractType,
    selectedInvoice,
    travelRows
}): JSX.Element => {
    const getJobLabel = React.useCallback((jobId: string): string => {
        const job = jobs.find((option) => option.field_13 === jobId);

        if (!jobId) {
            return "—";
        }

        return job?.field_19 ? `${jobId} | ${job.field_19}` : jobId;
    }, [jobs]);
    const resourceTotals = React.useMemo(() => {
        return resourceRows.reduce((totals, row) => ({
            standardHours: totals.standardHours + Number(row.standardHours || 0),
            overtimeHours: totals.overtimeHours + Number(row.overtimeHours || 0)
        }), { standardHours: 0, overtimeHours: 0 });
    }, [resourceRows]);
    const travelTotal = React.useMemo(() => {
        return travelRows.reduce((total, row) => total + Number(row.amount || 0), 0);
    }, [travelRows]);

    return (
        <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Donor / Receiver</Typography>
                    <Typography variant="body1" color="text.secondary">{`${form.donorEntity || "—"} ${RELATIONSHIP_SEPARATOR} ${form.receivingEntity || "—"}`}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Contract Framing</Typography>
                    <Typography variant="body1" color="text.secondary">{form.contractId || "—"} | {form.contractName || "—"}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Contract Type</Typography>
                    <Typography variant="body1" color="text.secondary">{selectedContractType.label}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Invoice / Task Order</Typography>
                    <Typography variant="body1" color="text.secondary">{selectedInvoice ? `${selectedInvoice.field_14} | ${selectedInvoice.field_42}` : "Not specified"}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Workflow Routing</Typography>
                    <Typography variant="body1" color="text.secondary">{form.pm?.Title || "—"} | {form.og || "—"} | {form.lob || "—"}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Period</Typography>
                    <Typography variant="body1" color="text.secondary">
                        {periodStart?.format("M/D/YYYY") || "—"} - {periodEnd?.format("M/D/YYYY") || "—"}
                    </Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <Divider sx={{ my: 0.5 }} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <Stack spacing={1.25}>
                        <Typography variant="subtitle2" fontWeight={600}>Resources</Typography>
                        {form.contractType === "ffp" && (
                            <Typography variant="body2" color="text.secondary">
                                FFP labor line: {getJobLabel(ffpLaborConfig.jobId)} | {ffpLaborConfig.laborCategory || "No labor category"}
                            </Typography>
                        )}
                        <TableContainer>
                            <Table size="small" sx={quietTableSx}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Employee</TableCell>
                                        <TableCell>State</TableCell>
                                        {form.contractType === "tm" && <TableCell>Job ID</TableCell>}
                                        {form.contractType === "tm" && <TableCell>Labor Category</TableCell>}
                                        {form.contractType === "tm" && <TableCell>Std Hrs</TableCell>}
                                        {form.contractType === "tm" && <TableCell>OT Hrs</TableCell>}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {resourceRows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={form.contractType === "tm" ? 6 : 2}>No resources entered.</TableCell>
                                        </TableRow>
                                    ) : (
                                        <>
                                            {resourceRows.map((row) => (
                                                <TableRow key={row.id}>
                                                    <TableCell>{row.employee?.Title ?? "—"}</TableCell>
                                                    <TableCell>{row.state || "—"}</TableCell>
                                                    {form.contractType === "tm" && <TableCell>{getJobLabel(row.jobId)}</TableCell>}
                                                    {form.contractType === "tm" && <TableCell>{row.laborCategory || "—"}</TableCell>}
                                                    {form.contractType === "tm" && <TableCell>{row.standardHours || "—"}</TableCell>}
                                                    {form.contractType === "tm" && <TableCell>{row.overtimeHours || "—"}</TableCell>}
                                                </TableRow>
                                            ))}
                                            {resourceRows.length > 1 && (
                                                <TableRow sx={totalsRowSx}>
                                                    <TableCell colSpan={form.contractType === "tm" ? 4 : 2}>Totals</TableCell>
                                                    {form.contractType === "tm" && <TableCell>{resourceTotals.standardHours || "—"}</TableCell>}
                                                    {form.contractType === "tm" && <TableCell>{resourceTotals.overtimeHours || "—"}</TableCell>}
                                                </TableRow>
                                            )}
                                        </>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Stack>
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <Stack spacing={1.25}>
                        <Typography variant="subtitle2" fontWeight={600}>Travel / ODC</Typography>
                        <TableContainer>
                            <Table size="small" sx={quietTableSx}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Job ID</TableCell>
                                        <TableCell>Description</TableCell>
                                        <TableCell>Amount</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {travelRows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4}>No travel or ODC lines entered.</TableCell>
                                        </TableRow>
                                    ) : (
                                        <>
                                            {travelRows.map((row) => (
                                                <TableRow key={row.id}>
                                                    <TableCell>{row.lineType.toUpperCase()}</TableCell>
                                                    <TableCell>{getJobLabel(row.jobId)}</TableCell>
                                                    <TableCell>{row.description || "—"}</TableCell>
                                                    <TableCell>{row.amount ? formatCurrency(Number(row.amount)) : "—"}</TableCell>
                                                </TableRow>
                                            ))}
                                            {travelRows.length > 1 && (
                                                <TableRow sx={totalsRowSx}>
                                                    <TableCell colSpan={3}>Totals</TableCell>
                                                    <TableCell>{formatCurrency(travelTotal)}</TableCell>
                                                </TableRow>
                                            )}
                                        </>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Stack>
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <Divider sx={{ my: 0.5 }} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Scope of Work</Typography>
                    <Typography variant="body1" color="text.secondary">{(form.scopeOfWork ?? "").trim() || "—"}</Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Justification</Typography>
                    <Typography variant="body1" color="text.secondary">{(form.justification ?? "").trim() || "—"}</Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Notes</Typography>
                    <Typography variant="body1" color="text.secondary">{(form.notes ?? "").trim() || "No notes entered."}</Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Attachments</Typography>
                    <Typography variant="body1" color="text.secondary">{attachmentsCount} file(s) currently attached to the draft header.</Typography>
                </Grid>
            </Grid>
        </Paper>
    );
};
