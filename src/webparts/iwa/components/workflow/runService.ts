import { Web } from "gd-sprest";
import { encodeListName, formatError } from "../common/utils";
import Strings from "../common/strings";
import { DataSource } from "../data/ds";
import {
    IAuthorizationItem,
    IWorkflowRunItem,
    WorkflowRole,
    WorkflowStepKey
} from "../data/props";

export class WorkflowRunService {

    static createFirstRun(
        authorization: IAuthorizationItem,
        approvers: {
            hrId?: number;
            OGPresidentId?: number;
            cfoId?: number;
        }
    ): Promise<IWorkflowRunItem> {
        const nowIso = new Date().toISOString();
        const titleBase = authorization.Title || authorization.contractName || `IWA-${authorization.Id}`;
        const creatorId = authorization.Author?.Id;
        const pmId = authorization.pm?.Id;
        const skipPmStep = !!pmId && !!creatorId && pmId === creatorId;
        const initialStepKey: WorkflowStepKey = skipPmStep || !pmId ? "hr" : "pm";
        const initialPendingRole: WorkflowRole = initialStepKey === "pm" ? "pm" : "hr";
        const initialPendingApproverId = initialStepKey === "pm"
            ? (pmId ?? null)
            : (approvers.hrId ?? DataSource.HR?.Id ?? null);

        return new Promise<IWorkflowRunItem>((resolve, reject) => {
            Web()
                .Lists(Strings.Sites.main.lists.WorkflowRuns)
                .Items()
                .add({
                    __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.WorkflowRuns)}ListItem` },
                    Title: `${titleBase}-RUN-1`,
                    authorizationId: authorization.Id,
                    runNumber: 1,
                    runType: "base",
                    runStatus: "active",
                    hasDecision: false,
                    outcome: "none",
                    currentStepKey: initialStepKey,
                    pendingRole: initialPendingRole,
                    pendingApproverId: initialPendingApproverId,
                    stepAssignedDate: nowIso,
                    skipPmStep,
                    hrId: approvers.hrId ?? DataSource.HR?.Id ?? null,
                    ogPresidentId: approvers.OGPresidentId ?? null,
                    cfoId: approvers.cfoId ?? DataSource.CFO?.Id ?? null
                })
                .execute(
                    (response) => {
                        const runId = response?.Id;

                        if (!runId) {
                            reject(new Error("Workflow Run was created but response did not include an Id. Please refresh."));
                            return;
                        }

                        Web()
                            .Lists(Strings.Sites.main.lists.WorkflowRuns)
                            .Items()
                            .getById(runId)
                            .query({
                                Select: DataSource.runSelectQuery,
                                Expand: DataSource.runExpandQuery
                            })
                            .execute(
                                (run) => resolve(run as unknown as IWorkflowRunItem),
                                (error) => reject(new Error(`Workflow Run created but failed to reload it: ${formatError(error)}`))
                            );
                    },
                    (error) => reject(new Error(`Error creating Workflow Run: ${formatError(error)}`))
                );
        });
    }

    static async updateHasDecision(runId: number, hasDecision: boolean = true): Promise<void> {
        if (!runId) {
            throw new Error("Workflow Run Id is required to update hasDecision.");
        }

        await Web()
            .Lists(Strings.Sites.main.lists.WorkflowRuns)
            .Items()
            .getById(runId)
            .update({
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.WorkflowRuns)}ListItem` },
                hasDecision
            })
            .executeAndWait();
    }
}
