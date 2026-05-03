import {
    AuthorizationStatus,
    IAuthorizationItem,
    IAppUserItem,
    IModItem,
    IWorkflowActionItem,
    IWorkflowRunItem,
    ModStatus,
    WorkflowActionType,
    WorkflowRole,
    workflowRoleLabels,
    workflowStepLabels
} from "../data/props";
import { getBackupCoverageMap } from "../workflow/workflowAccess";

export type MyWorkPresetView =
    | "all"
    | "needsAction"
    | "created"
    | "activity"
    | "activeWorkflow"
    | "closed";

export interface IMyWorkRow {
    authorization: IAuthorizationItem;
    currentRun?: IWorkflowRunItem;
    latestMyAction?: IWorkflowActionItem;
    createdByMe: boolean;
    needsMyAction: boolean;
    backupForNames: string[];
    actedOnByMe: boolean;
    myActionCount: number;
    isDraft: boolean;
    isModDraft: boolean;
    draftMod?: IModItem;
    relationshipBadges: string[];
    searchIndex: string;
}

export interface IMyWorkSummary {
    rows: IMyWorkRow[];
    draftCount: number;
    needsMyActionCount: number;
    backupCoverageCount: number;
    createdByMeCount: number;
    actedOnByMeCount: number;
}

const activeAuthorizationStatuses: AuthorizationStatus[] = ["submitted", "underReview"];
const closedAuthorizationStatuses: AuthorizationStatus[] = ["approved", "rejected", "canceled", "closed"];

/**
 * Human-friendly label map used by chips and table cells.
 */
export const authorizationStatusLabels: Record<AuthorizationStatus, string> = {
    draft: "Draft",
    submitted: "Submitted",
    underReview: "Under Review",
    approved: "Approved",
    rejected: "Rejected",
    canceled: "Canceled",
    closed: "Closed"
};

/**
 * Shared mod status label map in case the active item is a mod workflow.
 */
export const modStatusLabels: Record<ModStatus, string> = {
    draft: "Draft",
    submitted: "Submitted",
    underReview: "Under Review",
    approved: "Approved",
    rejected: "Rejected",
    canceled: "Canceled"
};

/**
 * Small display helper so action history reads like business text instead of enum values.
 */
export const workflowActionLabels: Record<WorkflowActionType, string> = {
    submitted: "Submitted",
    modified: "Modified",
    approved: "Approved",
    rejected: "Rejected",
    returned: "Returned",
    restarted: "Restarted",
    canceled: "Canceled",
    skipped: "Skipped",
    systemGenerated: "System",
    pdfGenerated: "PDF Generated"
};

/**
 * Color choices stay intentionally conservative so the page matches the rest of the app shell.
 */
export const getStatusChipColor = (
    status?: AuthorizationStatus | ModStatus
): "default" | "success" | "warning" | "error" | "info" => {
    switch (status) {
        case "approved":
        case "closed":
            return "success";
        case "submitted":
        case "underReview":
            return "warning";
        case "rejected":
        case "canceled":
            return "error";
        case "draft":
            return "default";
        default:
            return "info";
    }
};

const buildActionMap = (myActions: IWorkflowActionItem[]): Map<number, IWorkflowActionItem[]> => {
    const map = new Map<number, IWorkflowActionItem[]>();

    myActions.forEach((action: IWorkflowActionItem): undefined => {
        const authorizationId = action.authorization?.Id;

        if (typeof authorizationId !== "number" || authorizationId <= 0) {
            return undefined;
        }

        const existing = map.get(authorizationId) ?? [];
        existing.push(action);
        map.set(authorizationId, existing);
        return undefined;
    });

    return map;
};

const isMeaningfulMyAction = (
    action: IWorkflowActionItem,
    createdByMe: boolean
): boolean => {
    if (action.actionType === "approved" || action.actionType === "rejected" || action.actionType === "returned" || action.actionType === "restarted" || action.actionType === "canceled") {
        return true;
    }

    if (!createdByMe && action.actionType === "submitted") {
        return true;
    }

    return false;
};

const buildSearchIndex = (row: IMyWorkRow): string => {
    const bits: string[] = [
        row.authorization.Title,
        row.authorization.contractName,
        row.authorization.contractId,
        row.authorization.invoice,
        row.authorization.donorEntity,
        row.authorization.receivingEntity,
        row.authorization.og,
        row.authorization.lob,
        row.currentRun?.mod?.Title,
        row.currentRun?.pendingApprover?.Title,
        row.latestMyAction?.actionBy?.Title,
        ...row.relationshipBadges,
        ...row.backupForNames
    ].filter((value: string | undefined): value is string => !!value);

    return bits.join(" ").toLowerCase();
};

export const buildMyWorkSummary = (
    authorizations: IAuthorizationItem[],
    draftAuthorizations: IAuthorizationItem[],
    runByAuthorizationId: Map<number, IWorkflowRunItem>,
    draftModsByAuthorizationId: Map<number, IModItem>,
    myActions: IWorkflowActionItem[],
    appUsers: IAppUserItem[],
    currentUserId?: number
): IMyWorkSummary => {
    const backupCoverageMap = getBackupCoverageMap(appUsers, currentUserId);
    const myActionsByAuthorizationId = buildActionMap(myActions);

    const activeRows = authorizations
        .map((authorization: IAuthorizationItem): IMyWorkRow => {
            const currentRun = runByAuthorizationId.get(authorization.Id);
            const draftMod = draftModsByAuthorizationId.get(authorization.Id);
            const authorizationActions = myActionsByAuthorizationId.get(authorization.Id) ?? [];
            const pendingApproverId = currentRun?.pendingApprover?.Id;
            const backupForName = typeof pendingApproverId === "number"
                ? backupCoverageMap.get(pendingApproverId)?.Title
                : undefined;

            const createdByMe = authorization.Author?.Id === currentUserId || !!draftMod;
            const meaningfulActions = authorizationActions.filter((action: IWorkflowActionItem): boolean => {
                return isMeaningfulMyAction(action, createdByMe);
            });
            const latestMyAction = meaningfulActions[0];
            const needsMyAction = currentRun?.runStatus === "active" && pendingApproverId === currentUserId;
            const backupForNames = backupForName ? [backupForName] : [];
            const actedOnByMe = meaningfulActions.length > 0;

            // Relationship badges drive the visual "why is this on my page?" cues.
            const relationshipBadges: string[] = [];

            if (needsMyAction) {
                relationshipBadges.push("Needs My Action");
            }

            backupForNames.forEach((name: string): void => {
                relationshipBadges.push(`Backup for ${name}`);
            });

            if (createdByMe) {
                relationshipBadges.push("Created By Me");
            }

            if (actedOnByMe) {
                relationshipBadges.push("I Acted On This");
            }

            if (draftMod) {
                relationshipBadges.push("Mod Draft");
            }

            const row: IMyWorkRow = {
                authorization,
                currentRun,
                latestMyAction,
                createdByMe,
                needsMyAction,
                backupForNames,
                actedOnByMe,
                myActionCount: meaningfulActions.length,
                isDraft: !!draftMod,
                isModDraft: !!draftMod,
                draftMod,
                relationshipBadges,
                searchIndex: ""
            };

            row.searchIndex = buildSearchIndex(row);
            return row;
        })
        .filter((row: IMyWorkRow): boolean => {
            return row.relationshipBadges.length > 0;
        })
        .sort((left: IMyWorkRow, right: IMyWorkRow): number => {
            const leftPriority = left.needsMyAction ? 3 : left.backupForNames.length > 0 ? 2 : 0;
            const rightPriority = right.needsMyAction ? 3 : right.backupForNames.length > 0 ? 2 : 0;

            if (leftPriority !== rightPriority) {
                return rightPriority - leftPriority;
            }

            const leftRecent = new Date(
                left.latestMyAction?.actionDate ??
                left.currentRun?.stepAssignedDate ??
                left.authorization.Modified ??
                left.authorization.Created ??
                0
            ).getTime();

            const rightRecent = new Date(
                right.latestMyAction?.actionDate ??
                right.currentRun?.stepAssignedDate ??
                right.authorization.Modified ??
                right.authorization.Created ??
                0
            ).getTime();

            return rightRecent - leftRecent;
        });

    const draftRows = draftAuthorizations
        .map((authorization: IAuthorizationItem): IMyWorkRow => {
            const draftMod = draftModsByAuthorizationId.get(authorization.Id);
            const row: IMyWorkRow = {
                authorization,
                currentRun: undefined,
                latestMyAction: undefined,
                createdByMe: true,
                needsMyAction: false,
                backupForNames: [],
                actedOnByMe: false,
                myActionCount: 0,
                isDraft: true,
                isModDraft: !!draftMod,
                draftMod,
                relationshipBadges: [draftMod ? "Mod Draft" : "Draft I Started"],
                searchIndex: ""
            };

            row.searchIndex = buildSearchIndex(row);
            return row;
        })
        .sort((left, right) => new Date(right.authorization.Modified ?? right.authorization.Created ?? 0).getTime() - new Date(left.authorization.Modified ?? left.authorization.Created ?? 0).getTime());

    const rows = [...draftRows, ...activeRows];

    return {
        rows,
        draftCount: draftRows.length,
        needsMyActionCount: rows.filter((row: IMyWorkRow): boolean => row.needsMyAction).length,
        backupCoverageCount: rows.filter((row: IMyWorkRow): boolean => row.backupForNames.length > 0).length,
        createdByMeCount: rows.filter((row: IMyWorkRow): boolean => row.createdByMe).length,
        actedOnByMeCount: rows.filter((row: IMyWorkRow): boolean => row.actedOnByMe).length
    };
};

export const filterMyWorkRows = (
    rows: IMyWorkRow[],
    selectedView: MyWorkPresetView,
    searchText: string
): IMyWorkRow[] => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return rows.filter((row: IMyWorkRow): boolean => {
        const matchesSearch = !normalizedSearch || row.searchIndex.indexOf(normalizedSearch) >= 0;

        if (!matchesSearch) {
            return false;
        }

        switch (selectedView) {
            case "needsAction":
                return row.needsMyAction || row.backupForNames.length > 0;
            case "created":
                return row.createdByMe;
            case "activity":
                return row.actedOnByMe;
            case "activeWorkflow":
                return row.currentRun?.runStatus === "active" || activeAuthorizationStatuses.indexOf(row.authorization.authorizationStatus) >= 0;
            case "closed":
                return closedAuthorizationStatuses.indexOf(row.authorization.authorizationStatus) >= 0;
            case "all":
            default:
                return true;
        }
    });
};

export const getRunScopeLabel = (run?: IWorkflowRunItem): string => {
    if (!run) {
        return "No Active Workflow";
    }

    if (run.runType === "mod") {
        return run.mod?.Title ? `Mod ${run.mod.Title}` : "Mod Workflow";
    }

    return "Base IWA";
};

export const getPendingLabel = (run?: IWorkflowRunItem): string => {
    if (!run) {
        return "No active workflow";
    }

    if (run.pendingRole) {
        return workflowRoleLabels[run.pendingRole] ?? run.pendingRole;
    }

    if (run.currentStepKey) {
        return workflowStepLabels[run.currentStepKey] ?? run.currentStepKey;
    }

    return "Workflow";
};

export const getLatestActionSummary = (action?: IWorkflowActionItem): string => {
    if (!action) {
        return "No recorded actions by you yet";
    }

    const actionLabel = workflowActionLabels[action.actionType] ?? action.actionType;
    const roleLabel = action.role ? (workflowRoleLabels[action.role as WorkflowRole] ?? action.role) : undefined;

    return roleLabel ? `${actionLabel} as ${roleLabel}` : actionLabel;
};
