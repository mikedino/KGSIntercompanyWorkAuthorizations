import * as React from "react";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { IWorkflowActionItem, workflowStepLabels } from "../../data/props";
import { formatDate } from "../../common/utils";
import { quietTableSx } from "./iwaViewUtils";

interface IIwaHistoryTabProps {
    actions: IWorkflowActionItem[];
}

const getRevisionLabel = (action: IWorkflowActionItem): string => {
    if (!action.mod?.Id) {
        return "BASE";
    }

    const modNumber = action.mod.modNumber ??
        Number(action.mod.Title?.match(/MOD-?(\d+)/i)?.[1] ?? 0);

    return modNumber > 0 ? `MOD-${modNumber}` : "MOD";
};

export const IwaHistoryTab: React.FC<IIwaHistoryTabProps> = ({ actions }): JSX.Element => (
    <TableContainer>
        <Table size="small" sx={quietTableSx}>
            <TableHead>
                <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Rev</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Step</TableCell>
                    <TableCell>By</TableCell>
                    <TableCell>Comments</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {actions.length === 0 ? (
                    <TableRow><TableCell colSpan={5}>No workflow actions found.</TableCell></TableRow>
                ) : actions.map((action) => (
                    <TableRow key={action.Id}>
                        <TableCell>{formatDate(action.actionDate, true)}</TableCell>
                        <TableCell>{getRevisionLabel(action)}</TableCell>
                        <TableCell>{action.actionType.toUpperCase()}</TableCell>
                        <TableCell>{workflowStepLabels[action.stepKey] ?? action.stepKey}</TableCell>
                        <TableCell>{action.actionBy?.Title ?? "-"}</TableCell>
                        <TableCell>{action.comments || action.skipReason || "-"}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </TableContainer>
);
