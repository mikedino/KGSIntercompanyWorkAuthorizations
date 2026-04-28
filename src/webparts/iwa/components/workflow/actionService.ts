import { ContextInfo, Web } from "gd-sprest";
import { encodeListName, formatError } from "../common/utils";
import Strings from "../common/strings";
import { IAuthorizationItem, IWorkflowRunItem, WorkflowActionType, WorkflowStepKey } from "../data/props";

export class WorkflowActionService {

    static createSubmitted(
        authorization: IAuthorizationItem,
        workflowRun: IWorkflowRunItem,
        options?: {
            actionType?: Extract<WorkflowActionType, "submitted" | "modified">;
            comments?: string;
            changeSummary?: string;
            changePayloadJson?: string;
            modId?: number;
        }
    ): Promise<void> {
        const nowIso = new Date().toISOString();
        const runNumber = workflowRun.runNumber ?? 1;
        const actionType = options?.actionType ?? "submitted";
        const addBody: Record<string, unknown> = {
            __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.WorkflowActions)}ListItem` },
            Title: `${authorization.Title}-Run${runNumber}-${actionType}`,
            authorizationId: authorization.Id,
            workflowRunId: workflowRun.Id,
            stepKey: "submit",
            actionType,
            actionById: ContextInfo.userId,
            actionDate: nowIso,
            role: "requestor",
            fromStepKey: "submit",
            toStepKey: workflowRun.currentStepKey,
            wasSkipped: workflowRun.skipPmStep ?? false,
            skipReason: workflowRun.skipPmStep ? "PM is the submitter/creator of this authorization." : "",
            comments: options?.comments ?? "",
            changeSummary: options?.changeSummary ?? "",
            changePayloadJson: options?.changePayloadJson ?? ""
        };

        if (options?.modId) {
            addBody.modId = options.modId;
        }

        return new Promise<void>((resolve, reject) => {
            Web()
                .Lists(Strings.Sites.main.lists.WorkflowActions)
                .Items()
                .add(addBody)
                .execute(
                    () => resolve(),
                    (error) => reject(new Error(`Error creating ${actionType} Workflow Action: ${formatError(error)}`))
                );
        });
    }

    static createRestarted(
        authorization: IAuthorizationItem,
        workflowRun: IWorkflowRunItem,
        comments?: string
    ): Promise<void> {
        const nowIso = new Date().toISOString();
        const runNumber = workflowRun.runNumber ?? 1;
        const addBody: Record<string, unknown> = {
            __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.WorkflowActions)}ListItem` },
            Title: `${authorization.Title}-Run${runNumber}-${workflowRun.currentStepKey}-restarted`,
            authorizationId: authorization.Id,
            workflowRunId: workflowRun.Id,
            stepKey: workflowRun.currentStepKey,
            actionType: "restarted",
            actionById: ContextInfo.userId,
            actionDate: nowIso,
            role: "requestor",
            fromStepKey: workflowRun.currentStepKey,
            toStepKey: "submit",
            comments: comments ?? ""
        };

        if (workflowRun.mod?.Id) {
            addBody.modId = workflowRun.mod.Id;
        }

        return new Promise<void>((resolve, reject) => {
            Web()
                .Lists(Strings.Sites.main.lists.WorkflowActions)
                .Items()
                .add(addBody)
                .execute(
                    () => resolve(),
                    (error) => reject(new Error(`Error creating restarted Workflow Action: ${formatError(error)}`))
                );
        });
    }

    static createDecision(
        authorization: IAuthorizationItem,
        workflowRun: IWorkflowRunItem,
        actionType: Extract<WorkflowActionType, "approved" | "rejected" | "returned">,
        comments?: string,
        toStepKey?: WorkflowStepKey
    ): Promise<void> {
        const nowIso = new Date().toISOString();
        const runNumber = workflowRun.runNumber ?? 1;
        const addBody: Record<string, unknown> = {
            __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.WorkflowActions)}ListItem` },
            Title: `${authorization.Title}-Run${runNumber}-${workflowRun.currentStepKey}-${actionType}`,
            authorizationId: authorization.Id,
            workflowRunId: workflowRun.Id,
            stepKey: workflowRun.currentStepKey,
            actionType,
            actionById: ContextInfo.userId,
            actionDate: nowIso,
            role: workflowRun.pendingRole ?? "admin",
            fromStepKey: workflowRun.currentStepKey,
            toStepKey: toStepKey ?? workflowRun.currentStepKey,
            comments: comments ?? ""
        };

        if (workflowRun.mod?.Id) {
            addBody.modId = workflowRun.mod.Id;
        }

        return new Promise<void>((resolve, reject) => {
            Web()
                .Lists(Strings.Sites.main.lists.WorkflowActions)
                .Items()
                .add(addBody)
                .execute(
                    () => resolve(),
                    (error) => reject(new Error(`Error creating ${actionType} Workflow Action: ${formatError(error)}`))
                );
        });
    }
}
