import * as React from "react";
import { Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { ITravelOdcItem } from "../../data/props";
import { formatCurrency } from "../../common/utils";
import { getModScopeChipColor, getModScopeLabel, quietTableSx, totalsRowSx } from "./iwaViewUtils";

interface IIwaTravelOdcTabProps {
    travelOdcs: ITravelOdcItem[];
    travelTotal: number;
    travelDeltaTotal: number;
}

export const IwaTravelOdcTab: React.FC<IIwaTravelOdcTabProps> = ({
    travelOdcs,
    travelTotal,
    travelDeltaTotal
}): JSX.Element => (
    <TableContainer>
        <Table size="small" sx={quietTableSx}>
            <TableHead>
                <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Scope</TableCell>
                    <TableCell>Job ID</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Comments</TableCell>
                    <TableCell align="right">Amount</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {travelOdcs.length === 0 ? (
                    <TableRow><TableCell colSpan={6}>No travel or ODC lines found.</TableCell></TableRow>
                ) : (
                    <>
                        {travelOdcs.map((line) => (
                            <TableRow key={line.Id}>
                                <TableCell>{line.lineType.toUpperCase()}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={getModScopeLabel(line)}
                                        size="small"
                                        color={getModScopeChipColor(line)}
                                        variant="outlined"
                                    />
                                </TableCell>
                                <TableCell>{line.jobId || "-"}</TableCell>
                                <TableCell>{line.description || "-"}</TableCell>
                                <TableCell>{line.comments || "-"}</TableCell>
                                <TableCell align="right">{formatCurrency(line.amount)}</TableCell>
                            </TableRow>
                        ))}
                        {travelOdcs.length > 1 && (
                            <TableRow sx={totalsRowSx}>
                                <TableCell colSpan={5}>Totals</TableCell>
                                <TableCell align="right">
                                    <Stack spacing={0.25} alignItems="flex-end">
                                        <Typography variant="body2" fontWeight={600}>{formatCurrency(travelTotal)}</Typography>
                                        {travelDeltaTotal !== 0 && (
                                            <Typography variant="caption" color={travelDeltaTotal > 0 ? "success.main" : "error.main"}>
                                                {travelDeltaTotal > 0 ? "+" : ""}{formatCurrency(travelDeltaTotal)} mod
                                            </Typography>
                                        )}
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        )}
                    </>
                )}
            </TableBody>
        </Table>
    </TableContainer>
);
