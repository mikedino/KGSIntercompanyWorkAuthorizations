import { ContextInfo, Web } from "gd-sprest";
import { encodeListName, formatError } from "../common/utils";
import Strings from "../common/strings";
import { IAuthorizationItem, IWorkflowRunItem } from "../data/props";

export class WorkflowActionService {

    static createSubmitted(
        authorization: IAuthorizationItem,
        workflowRun: IWorkflowRunItem
    ): Promise<void> {
        const nowIso = new Date().toISOString();
        const runNumber = workflowRun.runNumber ?? 1;

        return new Promise<void>((resolve, reject) => {
            Web()
                .Lists(Strings.Sites.main.lists.WorkflowActions)
                .Items()
                .add({
                    __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.WorkflowActions)}ListItem` },
                    Title: `${authorization.Title}-Run${runNumber}-submit`,
                    authorizationId: authorization.Id,
                    workflowRunId: workflowRun.Id,
                    stepKey: "submit",
                    actionType: "submitted",
                    actionById: ContextInfo.userId,
                    actionDate: nowIso,
                    role: "requestor",
                    fromStepKey: "submit",
                    toStepKey: workflowRun.currentStepKey,
                    wasSkipped: workflowRun.skipPmStep ?? false,
                    skipReason: workflowRun.skipPmStep ? "PM is the submitter/creator of this authorization." : ""
                })
                .execute(
                    () => resolve(),
                    (error) => reject(new Error(`Error creating submitted Workflow Action: ${formatError(error)}`))
                );
        });
    }
}
