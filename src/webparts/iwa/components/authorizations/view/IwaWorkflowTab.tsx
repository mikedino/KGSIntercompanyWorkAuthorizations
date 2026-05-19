import * as React from "react";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import SummarizeOutlinedIcon from "@mui/icons-material/SummarizeOutlined";
import { IAuthorizationItem, IWorkflowActionItem, IWorkflowRunItem, WorkflowStepKey, workflowStepLabels } from "../../data/props";
import { formatDate } from "../../common/utils";
import { workflowRunStatusLabels } from "../../layout/allAuthorizationsUtils";
import { baseWorkflowSteps, getModScopeChipColor, getModScopeLabel, getStepAction, getWorkflowActionChipColor, getWorkflowStepApprover } from "./iwaViewUtils";

interface IIwaWorkflowTabProps {
    actions: IWorkflowActionItem[];
    authorization: IAuthorizationItem;
    expandedRunId: number | false;
    isFfpAuthorization: boolean;
    onExpandedRunChange: (runId: number | false) => void;
    onOpenChangeDialog: (action: IWorkflowActionItem) => void;
    onOpenCommentDialog: (dialog: { title: string; comments: string }) => void;
    workflowRuns: IWorkflowRunItem[];
}

export const IwaWorkflowTab: React.FC<IIwaWorkflowTabProps> = ({
    actions,
    authorization,
    expandedRunId,
    isFfpAuthorization,
    onExpandedRunChange,
    onOpenChangeDialog,
    onOpenCommentDialog,
    workflowRuns
}): JSX.Element => (
    <Stack spacing={2}>
        {workflowRuns.length === 0 ? (
            <Typography color="text.secondary">No workflow runs found.</Typography>
        ) : workflowRuns.map((run) => {
            const runActions = actions.filter((action) => action.workflowRun?.Id === run.Id);
            const runSteps: WorkflowStepKey[] = run.currentStepKey === "submitter" || runActions.some((action) => action.stepKey === "submitter")
                ? [...baseWorkflowSteps, "submitter"]
                : baseWorkflowSteps;
            const modifiedAction = runActions.find((action) => action.actionType === "modified" && (!!action.changeSummary || !!action.changePayloadJson));

            return (
                <Accordion
                    key={run.Id}
                    expanded={expandedRunId === run.Id}
                    onChange={(_event, expanded) => onExpandedRunChange(expanded ? run.Id : false)}
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
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" sx={{ width: "100%", pr: 1 }}>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Typography variant="h6" fontWeight={600}>Run {run.runNumber ?? "-"}</Typography>
                                <Chip
                                    label={getModScopeLabel({ lineScope: run.runType, mod: run.mod })}
                                    size="small"
                                    color={getModScopeChipColor({ lineScope: run.runType })}
                                    variant="outlined"
                                />
                                <Chip label={workflowRunStatusLabels[run.runStatus]} size="small" color={run.runStatus === "active" ? "info" : run.runStatus === "completed" ? "success" : "default"} variant={run.runStatus === "superseded" ? "outlined" : "filled"} />
                                {modifiedAction && (
                                    <Button
                                        size="small"
                                        startIcon={<SummarizeOutlinedIcon />}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onOpenChangeDialog(modifiedAction);
                                        }}
                                    >
                                        View Changes
                                    </Button>
                                )}
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                                {run.completedOn ? `Completed ${formatDate(run.completedOn, true)}` : `Started ${formatDate(run.Created, true)}`}
                            </Typography>
                        </Stack>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                        <Stack spacing={1.5}>
                            {runSteps.map((step) => {
                                const action = getStepAction(runActions, step);
                                const isCurrent = run.currentStepKey === step && run.runStatus === "active";
                                const rejectedStepIndex = runSteps.findIndex((candidate) => getStepAction(runActions, candidate)?.actionType === "rejected");
                                const stepIndex = runSteps.indexOf(step);
                                const skippedAfterRejection = rejectedStepIndex >= 0 && stepIndex > rejectedStepIndex && !action && step !== "submitter";
                                const skippedForFfpHr = step === "hr" && isFfpAuthorization;
                                const skipped = (step === "pm" && run.skipPmStep === true) || skippedForFfpHr || skippedAfterRejection;
                                const label = step === "submitter" && action?.actionType === "restarted"
                                    ? "Resubmitted"
                                    : workflowStepLabels[step];
                                const approver = getWorkflowStepApprover(step, authorization, run);
                                const completedBy = action?.actionBy?.Title ?? (action ? "System" : "");
                                const isReturnedToSubmitterStep = step === "submitter" && action?.actionType === "returned";
                                const actedOnBehalf = !isReturnedToSubmitterStep &&
                                    action?.actionBy?.Id &&
                                    approver?.Id &&
                                    action.actionBy.Id !== approver.Id &&
                                    step !== "submit";
                                const personDisplay = isReturnedToSubmitterStep
                                    ? `Returned to ${approver?.Title ?? "the submitter"} by ${completedBy}`
                                    : actedOnBehalf
                                        ? `${completedBy} on behalf of ${approver?.Title ?? "the assigned approver"}`
                                        : approver?.Title ?? "No approver assigned";
                                const statusLabel = skipped
                                    ? "Skipped"
                                    : isCurrent
                                        ? "Pending"
                                        : action
                                            ? action.actionType === "submitted"
                                                ? "Submitted"
                                                : action.actionType === "modified"
                                                    ? "Modified"
                                                    : action.actionType === "approved"
                                                        ? "Approved"
                                                        : action.actionType === "returned"
                                                            ? "Returned"
                                                            : action.actionType === "restarted"
                                                                ? "Restarted"
                                                                : "Rejected"
                                            : "Queued";

                                return (
                                    <Stack key={`${run.Id}-${step}`} direction="row" spacing={1.5} alignItems="stretch">
                                        <Stack alignItems="center" sx={{ pt: 0.5 }}>
                                            <Box
                                                sx={(theme) => ({
                                                    width: 14,
                                                    height: 14,
                                                    borderRadius: "50%",
                                                    bgcolor: isCurrent
                                                        ? theme.palette.warning.main
                                                        : skipped
                                                            ? theme.palette.divider
                                                            : action?.actionType === "rejected"
                                                                ? theme.palette.error.main
                                                                : action
                                                                    ? theme.palette.success.main
                                                                    : theme.palette.divider,
                                                    border: `2px solid ${theme.palette.background.paper}`
                                                })}
                                            />
                                            {stepIndex !== runSteps.length - 1 && (
                                                <Box sx={{ width: 2, flex: 1, minHeight: 34, bgcolor: "divider", mt: 0.5 }} />
                                            )}
                                        </Stack>
                                        <Paper
                                            variant="outlined"
                                            sx={{
                                                p: 1.75,
                                                flex: 1,
                                                borderColor: isCurrent ? "secondary.main" : "divider",
                                                bgcolor: isCurrent ? "action.hover" : "background.paper"
                                            }}
                                        >
                                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
                                                <Box>
                                                    <Stack direction="row" spacing={0.75} alignItems="center">
                                                        <Typography fontWeight={600}>{label}</Typography>
                                                        {action && !!action.comments && !(step === "submitter" && (action.actionType === "returned" || action.actionType === "restarted")) && (
                                                            <Tooltip title="View comments">
                                                                <IconButton
                                                                    size="small"
                                                                    color="secondary"
                                                                    onClick={() => onOpenCommentDialog({ title: `${label} Comments`, comments: action.comments ?? "" })}
                                                                    sx={{ p: 0.25 }}
                                                                >
                                                                    <ChatBubbleOutlineOutlinedIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </Stack>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {personDisplay}
                                                    </Typography>
                                                </Box>
                                                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                                                    <Stack spacing={0.5} alignItems="flex-end">
                                                        <Chip label={statusLabel} color={getWorkflowActionChipColor(action, isCurrent, skipped)} size="small" variant={skipped || !action && !isCurrent ? "outlined" : "filled"} />
                                                        {isCurrent && (!action || action.actionDate !== run.stepAssignedDate) && (
                                                            <Typography variant="caption" color="text.secondary">
                                                                {formatDate(run.stepAssignedDate, true)}
                                                            </Typography>
                                                        )}
                                                        {action && (
                                                            <Typography variant="caption" color="text.secondary">
                                                                {formatDate(action.actionDate, true)}
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                </Stack>
                                            </Stack>

                                            <Stack spacing={1}>
                                                {step === "pm" && skipped && run.skipPmStep && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        This step was skipped because the PM was the submitter
                                                    </Typography>
                                                )}
                                                {step === "hr" && skippedForFfpHr && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        HR Review is not required for FFP contracts.
                                                    </Typography>
                                                )}
                                            </Stack>
                                        </Paper>
                                    </Stack>
                                );
                            })}
                        </Stack>
                    </AccordionDetails>
                </Accordion>
            );
        })}
    </Stack>
);
