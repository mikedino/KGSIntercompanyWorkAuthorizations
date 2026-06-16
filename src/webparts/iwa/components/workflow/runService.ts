import { ContextInfo, Web } from "gd-sprest";
import { encodeListName, formatError } from "../common/utils";
import Strings from "../common/strings";
import { SharePointUserResolver } from "../common/sharePointUserResolver";
import { DataSource } from "../data/ds";
import {
    IAuthorizationItem,
    IModItem,
    IPeoplePicker,
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

type WorkflowApprovers = {
    hrId?: number;
    OGPresidentId?: number;
    cfoId?: number;
    hr?: IPeoplePicker;
    ogPresident?: IPeoplePicker;
    cfo?: IPeoplePicker;
};

export class WorkflowRunService {

    private static async createRun(
        authorization: IAuthorizationItem,
        approvers: WorkflowApprovers,
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
        const pmId = await SharePointUserResolver.resolvePersonIdForCurrentWeb(authorization.pm, authorization.pm?.Id, "workflow PM");
        const hrId = await SharePointUserResolver.resolvePersonIdForCurrentWeb(approvers.hr ?? DataSource.HR, approvers.hrId ?? DataSource.HR?.Id, "workflow HR approver");
        const ogPresidentId = await SharePointUserResolver.resolvePersonIdForCurrentWeb(approvers.ogPresident, approvers.OGPresidentId, "workflow OG President approver");
        const cfoId = await SharePointUserResolver.resolvePersonIdForCurrentWeb(approvers.cfo ?? DataSource.CFO, approvers.cfoId ?? DataSource.CFO?.Id, "workflow CFO approver");
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
                ? (hrId ?? null)
                : (ogPresidentId ?? null);
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
            // Person fields store User Information List IDs from this workflow
            // site collection. HR/CFO/OG President often come from config/lookup
            // site collections, so resolve them into this web before stamping.
            hrId: hrId ?? null,
            ogPresidentId: ogPresidentId ?? null,
            cfoId: cfoId ?? null
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
        approvers: WorkflowApprovers
    ): Promise<IWorkflowRunItem> {
        return this.createRun(authorization, approvers, 1);
    }

    static createRestartRun(
        authorization: IAuthorizationItem,
        nextRunNumber: number,
        approvers: WorkflowApprovers,
        restartReason: string,
        restartComment?: string
    ): Promise<IWorkflowRunItem> {
        return this.createRun(authorization, approvers, nextRunNumber, restartReason, restartComment);
    }

    static createModRun(
        authorization: IAuthorizationItem,
        mod: IModItem,
        nextRunNumber: number,
        approvers: WorkflowApprovers,
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

    static async updatePendingApprover(runId: number, pendingApproverId: number, pendingApprover?: IPeoplePicker): Promise<void> {
        if (!runId) {
            throw new Error("Workflow Run Id is required to update the pending approver.");
        }

        const resolvedPendingApproverId = await SharePointUserResolver.resolvePersonIdForCurrentWeb(
            pendingApprover,
            pendingApproverId,
            "workflow pending approver"
        );

        await Web()
            .Lists(Strings.Sites.main.lists.WorkflowRuns)
            .Items()
            .getById(runId)
            .update({
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.WorkflowRuns)}ListItem` },
                pendingApproverId: resolvedPendingApproverId,
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

    private static async getApproverIdForStep(authorization: IAuthorizationItem, run: IWorkflowRunItem, stepKey: WorkflowStepKey): Promise<number | undefined> {
        const configuredOgPresident = DataSource.OGs.find((og) => og.Title === authorization.og)?.president;

        switch (stepKey) {
            case "hr":
                return (await SharePointUserResolver.resolvePersonIdForCurrentWeb(run.hr ?? DataSource.HR, run.hr?.Id ?? DataSource.HR?.Id, "workflow HR decision approver")) ?? undefined;
            case "ogPresident":
                return (await SharePointUserResolver.resolvePersonIdForCurrentWeb(run.ogPresident ?? configuredOgPresident, run.ogPresident?.Id ?? configuredOgPresident?.Id, "workflow OG President decision approver")) ?? undefined;
            case "cfo":
                return (await SharePointUserResolver.resolvePersonIdForCurrentWeb(run.cfo ?? DataSource.CFO, run.cfo?.Id ?? DataSource.CFO?.Id, "workflow CFO decision approver")) ?? undefined;
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
            const submitterId = await SharePointUserResolver.resolvePersonIdForCurrentWeb(authorization.Author, authorization.Author?.Id, "workflow rejection submitter");

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
                    pendingApproverId: submitterId ?? null,
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

        const nextApproverId = nextStepKey ? await this.getApproverIdForStep(authorization, run, nextStepKey) : undefined;

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
                pendingApproverId: nextApproverId ?? null,
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
