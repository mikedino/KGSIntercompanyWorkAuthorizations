import * as React from "react";
import { Box, Grid, Paper, Stack, Typography } from "@mui/material";
import { IAuthorizationItem } from "../../data/props";
import { formatCurrency, formatDate, RELATIONSHIP_SEPARATOR } from "../../common/utils";

interface IIwaSummaryTabProps {
    authorization: IAuthorizationItem;
}

export const IwaSummaryTab: React.FC<IIwaSummaryTabProps> = ({ authorization }): JSX.Element => (
    <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, lg: 6, xl: 4 }}>
            <Paper variant="outlined" sx={{ p: 1.75, height: "100%" }}>
                <Typography variant="subtitle2" fontWeight={600}>Contract</Typography>
                <Grid container spacing={1.25} sx={{ mt: 0.25 }}>
                    {[
                        ["Contract ID", authorization.contractId || "-"],
                        ["Contract Name", authorization.contractName || "-"],
                        ["Invoice / Task Order", authorization.invoice || "Not specified"],
                        ["Project Manager", authorization.pm?.Title || "-"],
                        ["Period", `${formatDate(authorization.periodStart, false)} - ${formatDate(authorization.periodEnd, false)}`]
                    ].map(([label, value]) => (
                        <Grid key={label} size={{ xs: 12, sm: 6 }}>
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                            <Typography fontWeight={500}>{value}</Typography>
                        </Grid>
                    ))}
                </Grid>
            </Paper>
        </Grid>
        <Grid size={{ xs: 12, lg: 6, xl: 4 }}>
            <Paper variant="outlined" sx={{ p: 1.75, height: "100%" }}>
                <Typography variant="subtitle2" fontWeight={600}>Entities / Organization</Typography>
                <Stack spacing={1} sx={{ mt: 0.5 }}>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Entities</Typography>
                        <Typography fontWeight={500}>
                            {authorization.donorEntity || "-"} <Box component="span" sx={{ color: "secondary.main" }}>{RELATIONSHIP_SEPARATOR}</Box> {authorization.receivingEntity || "-"}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Operating Group / LOB</Typography>
                        <Typography fontWeight={500}>{authorization.og || "-"} | {authorization.lob || "-"}</Typography>
                    </Box>
                </Stack>
            </Paper>
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
            <Paper variant="outlined" sx={{ p: 1.75, height: "100%" }}>
                <Typography variant="subtitle2" fontWeight={600}>Cost Summary</Typography>
                <Grid container spacing={1.25} sx={{ mt: 0.25 }}>
                    {[
                        ["Base Labor", authorization.baseLaborAmount],
                        ["Base Travel / ODC", authorization.baseTravelAmount],
                        ["Base Grand Total", authorization.baseGrandTotal],
                        ["Approved Labor", authorization.approvedLaborAmount],
                        ["Approved Travel / ODC", authorization.approvedTravelAmount],
                        ["Approved Grand Total", authorization.approvedGrandTotal]
                    ].map(([label, value]) => (
                        <Grid key={String(label)} size={{ xs: 6, sm: 4 }}>
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                            <Typography fontWeight={600}>{formatCurrency(Number(value ?? 0))}</Typography>
                        </Grid>
                    ))}
                </Grid>
            </Paper>
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>Scope of Work</Typography>
                <Typography color="text.secondary">{authorization.scopeOfWork || "-"}</Typography>
            </Paper>
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>Justification</Typography>
                <Typography color="text.secondary">{authorization.justification || "-"}</Typography>
            </Paper>
        </Grid>
    </Grid>
);
