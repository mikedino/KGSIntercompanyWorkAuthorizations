import * as React from "react";
import { Alert, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import { IModItem, ITravelOdcItem } from "../../data/props";
import { formatCurrency } from "../../common/utils";
import { getModScopeChipColor, getModScopeLabel, quietTableSx, totalsRowSx } from "./iwaViewUtils";

interface IIwaTravelOdcTabProps {
    mods: IModItem[];
    travelOdcs: ITravelOdcItem[];
    travelTotal: number;
    travelDeltaTotal: number;
}

export const IwaTravelOdcTab: React.FC<IIwaTravelOdcTabProps> = ({
    mods,
    travelOdcs,
    travelTotal,
    travelDeltaTotal
}): JSX.Element => {
    const excludedModIds = React.useMemo(() => {
        return new Set(
            mods
                .filter((mod) => mod.modStatus === "rejected" || mod.modStatus === "canceled")
                .map((mod) => mod.Id)
        );
    }, [mods]);
    const isExcludedLine = React.useCallback((line: ITravelOdcItem): boolean => {
        return line.lineScope === "mod" && !!line.mod?.Id && excludedModIds.has(line.mod.Id);
    }, [excludedModIds]);
    const hasExcludedLines = travelOdcs.some(isExcludedLine);
    const renderScopeChip = (line: ITravelOdcItem): React.ReactNode => {
        const label = getModScopeLabel(line);
        const mod = mods.find((item) => item.Id === line.mod?.Id);
        const isExcluded = mod?.modStatus === "rejected" || mod?.modStatus === "canceled";
        const tooltip = isExcluded
            ? `${label} was ${mod.modStatus}. Its lines and resources are retained for historical reference and excluded from totals.`
            : "";
        const chip = (
            <Chip
                label={label}
                size="small"
                color={isExcluded ? "error" : getModScopeChipColor(line)}
                icon={isExcluded ? <CancelOutlinedIcon /> : undefined}
                variant="outlined"
                aria-label={tooltip || label}
            />
        );

        return tooltip ? <Tooltip title={tooltip}>{chip}</Tooltip> : chip;
    };

    return (
    <Stack spacing={2}>
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
                        {travelOdcs.map((line) => {
                            const isExcluded = isExcludedLine(line);

                            return <TableRow key={line.Id}>
                                <TableCell>{line.lineType.toUpperCase()}</TableCell>
                                <TableCell>
                                    {renderScopeChip(line)}
                                </TableCell>
                                <TableCell>{line.jobId || "-"}</TableCell>
                                <TableCell>{line.description || "-"}</TableCell>
                                <TableCell>{line.comments || "-"}</TableCell>
                                <TableCell align="right">
                                    <Typography component="span" sx={isExcluded ? { textDecoration: "line-through", color: "error.main" } : undefined}>
                                        {formatCurrency(line.amount)}
                                    </Typography>
                                    {isExcluded && <Typography component="span" color="error.main"> *</Typography>}
                                </TableCell>
                            </TableRow>;
                        })}
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
      {hasExcludedLines && (
          <Alert severity="warning">
              * Rejected or canceled MOD lines are shown for historical reference but are not included in the totals.
          </Alert>
      )}
    </Stack>
    );
};
