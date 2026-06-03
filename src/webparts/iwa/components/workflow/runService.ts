import { ContextInfo, Web } from "gd-sprest";
import { encodeListName, formatError } from "../common/utils";
import Strings from "../common/strings";
import { DataSource } from "../data/ds";
import {
    IAuthorizationItem,
    IModItem,
    IWorkflowRunItem,
    RunType,
    WorkflowRole,
    WorkflowStepKey
} from "../data/props";

export interface IRunDecisionResult {
    completed: boolean;
    rejected: boolean;
    nextStepKey?: WorkflowStepKey;
    nowIso: string;
}

export class WorkflowRunService {

    private static createRun(
        authorization: IAuthorizationItem,
        approvers: {
            hrId?: number;
            OGPresidentId?: number;
            cfoId?: number;
        },
        runNumber: number,
        restartReason?: string,
        restartComment?: string,
        options?: {
            runType?: RunType;
            modId?: number;
            titleSuffix?: string;
        }
    ): Promise<IWorkflowRunItem> {
        const nowIso = new Date().toISOString();
        const titleBase = authorization.Title || authorization.contractName || `IWA-${authorization.Id}`;
        const creatorId = options?.runType === "mod" ? ContextInfo.userId : authorization.Author?.Id;
        const pmId = authorization.pm?.Id;
        const skipPmStep = !!pmId && !!creatorId && pmId === creatorId;
        const initialStepKey: WorkflowStepKey = skipPmStep || !pmId
            ? authorization.contractType === "tm" ? "hr" : "ogPresident"
            : "pm";
        const initialPendingRole: WorkflowRole = initialStepKey === "pm"
            ? "pm"
            : initialStepKey === "hr"
                ? "hr"
                : "ogPresident";
        const initialPendingApproverId = initialStepKey === "pm"
            ? (pmId ?? null)
            : initialStepKey === "hr"
                ? (approvers.hrId ?? DataSource.HR?.Id ?? null)
                : (approvers.OGPresidentId ?? null);
        const addBody: Record<string, unknown> = {
            __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.WorkflowRuns)}ListItem` },
            Title: `${titleBase}${options?.titleSuffix ?? ""}-RUN-${runNumber}`,
            authorizationId: authorization.Id,
            runNumber,
            runType: options?.runType ?? "base",
            runStatus: "active",
            hasDecision: false,
            outcome: "none",
            currentStepKey: initialStepKey,
            pendingRole: initialPendingRole,
            pendingApproverId: initialPendingApproverId,
            stepAssignedDate: nowIso,
            skipPmStep,
            restartReason: restartReason ?? "",
            restartComment: restartComment ?? "",
            hrId: approvers.hrId ?? DataSource.HR?.Id ?? null,
            ogPresidentId: approvers.OGPresidentId ?? null,
            cfoId: approvers.cfoId ?? DataSource.CFO?.Id ?? null
        };

        if (options?.modId) {
            addBody.modId = options.modId;
        }

        return new Promise<IWorkflowRunItem>((resolve, reject) => {
            Web()
                .Lists(Strings.Sites.main.lists.WorkflowRuns)
                .Items()
                .add(addBody)
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

    static createFirstRun(
        authorization: IAuthorizationItem,
        approvers: {
            hrId?: number;
            OGPresidentId?: number;
            cfoId?: number;
        }
    ): Promise<IWorkflowRunItem> {
        return this.createRun(authorization, approvers, 1);
    }

    static createRestartRun(
        authorization: IAuthorizationItem,
        nextRunNumber: number,
        approvers: {
            hrId?: number;
            OGPresidentId?: number;
            cfoId?: number;
        },
        restartReason: string,
        restartComment?: string
    ): Promise<IWorkflowRunItem> {
        return this.createRun(authorization, approvers, nextRunNumber, restartReason, restartComment);
    }

    static createModRun(
        authorization: IAuthorizationItem,
        mod: IModItem,
        nextRunNumber: number,
        approvers: {
            hrId?: number;
            OGPresidentId?: number;
            cfoId?: number;
        },
        restartReason?: string,
        restartComment?: string
    ): Promise<IWorkflowRunItem> {
        return this.createRun(authorization, approvers, nextRunNumber, restartReason, restartComment, {
            runType: "mod",
            modId: mod.Id,
            titleSuffix: `-MOD-${String(mod.modNumber).padStart(2, "0")}`
        });
    }

    static async getNextRunNumber(authorizationId: number): Promise<number> {
        if (!authorizationId) {
            return 1;
        }

        return new Promise<number>((resolve, reject) => {
            Web()
                .Lists(Strings.Sites.main.lists.WorkflowRuns)
                .Items()
                .query({
                    Select: ["Id", "runNumber"],
                    Filter: `authorization/Id eq ${authorizationId}`,
                    OrderBy: ["runNumber desc"],
                    Top: 1
                })
                .execute(
                    (items) => {
                        const latestRun = items?.results?.[0] as { runNumber?: number } | undefined;
                        const maxRunNumber = Number(latestRun?.runNumber ?? 0);
                        resolve(Number.isFinite(maxRunNumber) ? maxRunNumber + 1 : 1);
                    },
                    (error) => reject(new Error(`Error calculating next workflow run number: ${formatError(error)}`))
                );
        });
    }

    static async supersedeRun(runId: number, restartReason: string, restartComment?: string): Promise<void> {
        if (!runId) {
            throw new Error("Workflow Run Id is required to supersede a workflow run.");
        }

        await Web()
            .Lists(Strings.Sites.main.lists.WorkflowRuns)
            .Items()
            .getById(runId)
            .update({
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.WorkflowRuns)}ListItem` },
                runStatus: "superseded",
                outcome: "restarted",
                completedOn: new Date().toISOString(),
                pendingRole: null,
                pendingApproverId: null,
                stepAssignedDate: null,
                restartReason,
                restartComment: restartComment ?? ""
            })
            .executeAndWait();
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

    static async updatePendingApprover(runId: number, pendingApproverId: number): Promise<void> {
        if (!runId) {
            throw new Error("Workflow Run Id is required to update the pending approver.");
        }

        await Web()
            .Lists(Strings.Sites.main.lists.WorkflowRuns)
            .Items()
            .getById(runId)
            .update({
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.WorkflowRuns)}ListItem` },
                pendingApproverId,
                stepAssignedDate: new Date().toISOString()
            })
            .executeAndWait();
    }

    private static getNextStepKey(authorization: IAuthorizationItem, stepKey: WorkflowStepKey): WorkflowStepKey | undefined {
        switch (stepKey) {
            case "pm":
                return authorization.contractType === "tm" ? "hr" : "ogPresident";
            case "hr":
                return "ogPresident";
            case "ogPresident":
                return "cfo";
            default:
                return undefined;
        }
    }

    private static getPendingRole(stepKey: WorkflowStepKey): WorkflowRole | undefined {
        switch (stepKey) {
            case "pm":
                return "pm";
            case "hr":
                return "hr";
            case "ogPresident":
                return "ogPresident";
            case "cfo":
                return "cfo";
            case "submitter":
                return "requestor";
            default:
                return undefined;
        }
    }

    private static getApproverIdForStep(run: IWorkflowRunItem, stepKey: WorkflowStepKey): number | undefined {
        switch (stepKey) {
            case "hr":
                return run.hr?.Id ?? DataSource.HR?.Id;
            case "ogPresident":
                return run.ogPresident?.Id;
            case "cfo":
                return run.cfo?.Id ?? DataSource.CFO?.Id;
            default:
                return undefined;
        }
    }

    static async applyDecision(
        authorization: IAuthorizationItem,
        run: IWorkflowRunItem,
        decision: "approved" | "rejected"
    ): Promise<IRunDecisionResult> {
        if (!run?.Id) {
            throw new Error("Workflow Run Id is required to apply a workflow decision.");
        }

        const nowIso = new Date().toISOString();

        if (decision === "rejected") {
            await Web()
                .Lists(Strings.Sites.main.lists.WorkflowRuns)
                .Items()
                .getById(run.Id)
                .update({
                    __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.WorkflowRuns)}ListItem` },
                    runStatus: "active",
                    outcome: "rejected",
                    hasDecision: true,
                    currentStepKey: "submitter",
                    pendingRole: "requestor",
                    pendingApproverId: authorization.Author?.Id ?? null,
                    stepAssignedDate: nowIso
                })
                .executeAndWait();

            return {
                completed: false,
                rejected: true,
                nextStepKey: "submitter",
                nowIso
            };
        }

        const nextStepKey = this.getNextStepKey(authorization, run.currentStepKey);

        if (!nextStepKey) {
            await Web()
                .Lists(Strings.Sites.main.lists.WorkflowRuns)
                .Items()
                .getById(run.Id)
                .update({
                    __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.WorkflowRuns)}ListItem` },
                    runStatus: "completed",
                    outcome: "approved",
                    completedOn: nowIso,
                    hasDecision: true,
                    pendingRole: null,
                    pendingApproverId: null,
                    stepAssignedDate: null
                })
                .executeAndWait();

            return {
                completed: true,
                rejected: false,
                nowIso
            };
        }

        await Web()
            .Lists(Strings.Sites.main.lists.WorkflowRuns)
            .Items()
            .getById(run.Id)
            .update({
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.WorkflowRuns)}ListItem` },
                runStatus: "active",
                currentStepKey: nextStepKey,
                hasDecision: true,
                pendingRole: this.getPendingRole(nextStepKey) ?? null,
                pendingApproverId: this.getApproverIdForStep(run, nextStepKey) ?? null,
                stepAssignedDate: nowIso
            })
            .executeAndWait();

        return {
            completed: false,
            rejected: false,
            nextStepKey,
            nowIso
        };
    }
}
