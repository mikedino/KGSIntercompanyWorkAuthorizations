import * as React from "react";
import { Box, Button, Collapse, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import { IPriorResourceRow } from "./workPackageTypes";

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

interface IIwaPriorResourcesPanelProps {
    open: boolean;
    priorResourceRows: IPriorResourceRow[];
    onCopyAll: () => void;
    onCopyResource: (row: IPriorResourceRow) => void;
}

export const IwaPriorResourcesPanel: React.FC<IIwaPriorResourcesPanelProps> = ({
    open,
    priorResourceRows,
    onCopyAll,
    onCopyResource
}): JSX.Element => (
    <Collapse in={open} unmountOnExit>
        <Paper variant="outlined" sx={{ p: 1.5, borderColor: "info.main", borderWidth: 3 }}>
            <Stack spacing={1.25}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                    <Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                            Prior Resources
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Copy approved resources into this mod with zero hours, then enter the changed hours.
                        </Typography>
                    </Box>
                    <Button
                        size="small"
                        color="success"
                        variant="contained"
                        startIcon={<ContentCopyOutlinedIcon />}
                        onClick={onCopyAll}
                        disabled={priorResourceRows.length === 0}
                        sx={{ minHeight: 0, py: 0.35, alignSelf: { xs: "stretch", sm: "center" } }}
                    >
                        Copy All
                    </Button>
                </Stack>
                {priorResourceRows.length === 0 ? (
                    <Typography
                        variant="body2"
                        color="success.main"
                        fontWeight={700}
                        sx={{ py: 1, fontStyle: "italic" }}
                    >
                        All prior resources have been copied into this mod.
                    </Typography>
                ) : (
                    <TableContainer>
                        <Table size="small" sx={quietTableSx}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Employee</TableCell>
                                    <TableCell>Approved Hours</TableCell>
                                    <TableCell align="right">Action</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {priorResourceRows.map((row) => (
                                    <TableRow key={row.id} hover>
                                        <TableCell>
                                            <Stack spacing={0.15}>
                                                <Typography variant="body2" fontWeight={600}>{row.employee.Title}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {row.jobId || "No Job ID"} | {row.state || "No state"} | {row.laborCategory || "No labor category"}
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            {row.approvedTotalStandardHours + row.approvedTotalOvertimeHours}
                                            <Typography component="span" variant="caption" color="text.secondary">
                                                {" "}({row.approvedTotalStandardHours} std / {row.approvedTotalOvertimeHours} OT)
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Button size="small" color="success" startIcon={<ContentCopyOutlinedIcon />} onClick={() => onCopyResource(row)}>
                                                Copy
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Stack>
        </Paper>
    </Collapse>
);
