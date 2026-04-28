import { Web } from "gd-sprest";
import { IWorkflowActionItem, IWorkflowRunItem } from "../data/props";
import Strings from "../common/strings";
import { formatError } from "../common/utils";

export class WorkflowService {

    private static readonly runSelectQuery: string[] = [
        "Id", "Title", "runNumber",
        "runType", "runStatus", "hasDecision", "outcome",
        "currentStepKey", "pendingRole", "stepAssignedDate",
        "completedOn", "skipPmStep", "restartReason", "restartComment", "approvedSnapshotJson",
        "Created", "Modified", "authorization/Id",
        "authorization/Title", "mod/Id", "mod/Title",
        "pendingApprover/Id", "pendingApprover/Title", "pendingApprover/EMail",
        "hr/Id", "hr/Title", "hr/EMail",
        "ogPresident/Id", "ogPresident/Title", "ogPresident/EMail",
        "cfo/Id", "cfo/Title", "cfo/EMail"
    ];

    private static readonly runExpandQuery: string[] = ["authorization", "mod", "pendingApprover", "hr", "ogPresident", "cfo"];

    private static readonly actionSelectQuery: string[] = [
        "Id", "Title", "stepKey",
        "actionType", "actionDate", "comments", "changeSummary", "changePayloadJson",
        "role", "fromStepKey", "toStepKey",
        "wasSkipped", "skipReason", "Created",
        "Modified", "authorization/Id", "authorization/Title",
        "mod/Id", "mod/Title", "workflowRun/Id",
        "workflowRun/Title", "actionBy/Id", "actionBy/Title",
        "actionBy/EMail"
    ];

    private static readonly actionExpandQuery: string[] = ["authorization", "mod", "workflowRun", "actionBy"];

    static getRunsByAuthorization(authorizationId: number): Promise<IWorkflowRunItem[]> {
        return new Promise<IWorkflowRunItem[]>((resolve, reject) => {
            Web().Lists(Strings.Sites.main.lists.WorkflowRuns).Items().query({
                Select: this.runSelectQuery,
                Expand: this.runExpandQuery,
                Filter: `authorization/Id eq ${authorizationId}`,
                OrderBy: ["runNumber asc"],
                Top: 5000
            }).execute(
                (items) => resolve((items?.results ?? []) as unknown as IWorkflowRunItem[]),
                (error) => reject(new Error(`Error fetching Workflow Runs by Authorization: ${formatError(error)}`))
            );
        });
    }

    static getActionsByAuthorization(authorizationId: number): Promise<IWorkflowActionItem[]> {
        return new Promise<IWorkflowActionItem[]>((resolve, reject) => {
            Web().Lists(Strings.Sites.main.lists.WorkflowActions).Items().query({
                Select: this.actionSelectQuery,
                Expand: this.actionExpandQuery,
                Filter: `authorization/Id eq ${authorizationId}`,
                OrderBy: ["actionDate desc", "Id desc"],
                Top: 5000
            }).execute(
                (items) => resolve((items?.results ?? []) as unknown as IWorkflowActionItem[]),
                (error) => reject(new Error(`Error fetching Workflow Actions by Authorization: ${formatError(error)}`))
            );
        });
    }

    static getMyActions(userId: number, sinceIso?: string): Promise<IWorkflowActionItem[]> {
        return new Promise<IWorkflowActionItem[]>((resolve, reject) => {
            if (!userId || userId <= 0) {
                resolve([]);
                return;
            }

            const sinceFilter = sinceIso ? ` and actionDate ge datetime'${sinceIso}'` : "";
            const filter = `actionBy/Id eq ${userId}${sinceFilter}`;

            Web().Lists(Strings.Sites.main.lists.WorkflowActions).Items().query({
                Select: this.actionSelectQuery,
                Expand: this.actionExpandQuery,
                Filter: filter,
                OrderBy: ["actionDate desc", "Id desc"],
                Top: 5000
            }).execute(
                (items) => resolve((items?.results ?? []) as unknown as IWorkflowActionItem[]),
                (error) => reject(new Error(`Error fetching My Workflow Actions: ${formatError(error)}`))
            );
        });
    }

    static getActionsByDateRange(startIso: string): Promise<IWorkflowActionItem[]> {
        return new Promise<IWorkflowActionItem[]>((resolve, reject) => {
            const filter = `actionDate ne null and actionDate ge datetime'${startIso}'`;

            Web().Lists(Strings.Sites.main.lists.WorkflowActions).Items().query({
                Select: this.actionSelectQuery,
                Expand: this.actionExpandQuery,
                Filter: filter,
                OrderBy: ["actionDate desc", "Id desc"],
                Top: 5000
            }).execute(
                (items) => resolve((items?.results ?? []) as unknown as IWorkflowActionItem[]),
                (error) => reject(new Error(`Error fetching Workflow Actions by Date Range: ${formatError(error)}`))
            );
        });
    }

    static getDashboardActions(startIso?: string): Promise<IWorkflowActionItem[]> {
        if (startIso) {
            return this.getActionsByDateRange(startIso);
        }

        return new Promise<IWorkflowActionItem[]>((resolve, reject) => {
            Web().Lists(Strings.Sites.main.lists.WorkflowActions).Items().query({
                Select: this.actionSelectQuery,
                Expand: this.actionExpandQuery,
                OrderBy: ["actionDate desc", "Id desc"],
                Top: 5000
            }).execute(
                (items) => resolve((items?.results ?? []) as unknown as IWorkflowActionItem[]),
                (error) => reject(new Error(`Error fetching Dashboard Workflow Actions: ${formatError(error)}`))
            );
        });
    }
}
