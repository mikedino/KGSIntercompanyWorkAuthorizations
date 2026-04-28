import { Web } from "gd-sprest";
import Strings from "../common/strings";
import { encodeListName } from "../common/utils";
import { AuthorizationService } from "../authorizations/iwaService";
import { IAuthorizationItem, IWorkflowRunItem, WorkflowStepKey } from "../data/props";
import { ModService } from "../mods/modService";
import { WorkflowActionService } from "./actionService";
import { WorkflowRunService } from "./runService";

type WorkflowDecision = "approved" | "rejected";

export class WorkflowDecisionService {

    private static getNextStepKey(stepKey: WorkflowStepKey, decision: WorkflowDecision): WorkflowStepKey | undefined {
        if (decision === "rejected") {
            return "submitter";
        }

        switch (stepKey) {
            case "pm":
                return "hr";
            case "hr":
                return "ogPresident";
            case "ogPresident":
                return "cfo";
            default:
                return undefined;
        }
    }

    private static buildApprovedSnapshot(authorization: IAuthorizationItem): Record<string, unknown> {
        return {
            Title: authorization.Title,
            donorEntity: authorization.donorEntity,
            donorEntityAbbr: authorization.donorEntityAbbr ?? "",
            donorGmId: authorization.donorGm?.Id ?? null,
            receivingEntity: authorization.receivingEntity,
            receivingEntityAbbr: authorization.receivingEntityAbbr ?? "",
            receivingGmId: authorization.receivingGm?.Id ?? null,
            og: authorization.og ?? "",
            lob: authorization.lob ?? "",
            contractName: authorization.contractName,
            contractId: authorization.contractId,
            invoice: authorization.invoice ?? "",
            contractType: authorization.contractType,
            periodStart: authorization.periodStart || null,
            periodEnd: authorization.periodEnd || null,
            scopeOfWork: authorization.scopeOfWork ?? "",
            justification: authorization.justification ?? "",
            notes: authorization.notes ?? "",
            baseLaborAmount: authorization.baseLaborAmount ?? 0,
            baseTravelAmount: authorization.baseTravelAmount ?? 0,
            baseGrandTotal: authorization.baseGrandTotal ?? 0
        };
    }

    static async submitDecision(
        authorization: IAuthorizationItem,
        run: IWorkflowRunItem,
        decision: WorkflowDecision,
        comments?: string
    ): Promise<void> {
        const toStepKey = this.getNextStepKey(run.currentStepKey, decision);

        await WorkflowActionService.createDecision(authorization, run, decision, comments, toStepKey);

        const result = await WorkflowRunService.applyDecision(authorization, run, decision);

        if (decision === "rejected") {
            await WorkflowActionService.createDecision(
                authorization,
                { ...run, currentStepKey: "submitter", pendingRole: "requestor" },
                "returned",
                comments ? `Returned after rejection: ${comments}` : "Returned after rejection",
                "submitter"
            );
            if (run.runType === "mod" && run.mod?.Id) {
                await ModService.updateWorkflowStatus(run.mod.Id, "rejected");
            } else {
                await AuthorizationService.updateWorkflowStatus(authorization.Id, "rejected");
            }
            return;
        }

        if (result.completed) {
            await Web()
                .Lists(Strings.Sites.main.lists.WorkflowRuns)
                .Items()
                .getById(run.Id)
                .update({
                    __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.WorkflowRuns)}ListItem` },
                    approvedSnapshotJson: JSON.stringify(this.buildApprovedSnapshot(authorization))
                })
                .executeAndWait();

            if (run.runType === "mod" && run.mod?.Id) {
                await ModService.updateWorkflowStatus(run.mod.Id, "approved", run.Id);
                await AuthorizationService.updateWorkflowStatus(authorization.Id, "approved", run.Id);
            } else {
                await AuthorizationService.updateWorkflowStatus(authorization.Id, "approved", run.Id);
            }
            return;
        }

        if (run.runType === "mod" && run.mod?.Id) {
            await ModService.updateWorkflowStatus(run.mod.Id, "underReview");
        } else {
            await AuthorizationService.updateWorkflowStatus(authorization.Id, "underReview");
        }
    }
}
