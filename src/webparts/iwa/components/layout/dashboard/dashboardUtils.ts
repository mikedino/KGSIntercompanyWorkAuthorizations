import {
    IAuthorizationItem,
    IModItem,
    IWorkflowActionItem,
    IWorkflowRunItem,
    WorkflowRole,
    workflowRoleLabels
} from "../../data/props";
import { formatCurrency, formatDate, formatSinceDate } from "../../common/utils";
import { authorizationStatusLabels, workflowActionLabels } from "../myWorkUtils";

export interface IDashboardMetric {
    key: string;
    label: string;
    value: string;
    detail: string;
    route?: string;
}

export interface IDashboardQueueItem {
    role: WorkflowRole;
    label: string;
    count: number;
    route: string;
}

export interface IDashboardAttentionItem {
    key: string;
    label: string;
    title: string;
    detail: string;
    route: string;
    severity: "info" | "warning" | "error";
}

export interface IDashboardActivityItem {
    key: string;
    title: string;
    detail: string;
    when: string;
    route: string;
    tone: "success" | "warning" | "error" | "info";
}

export interface IDashboardFundingBar {
    key: string;
    label: string;
    value: number;
    formattedValue: string;
    percent: number;
}

export interface IDashboardRecentIwa {
    key: string;
    title: string;
    detail: string;
    amount: string;
    route: string;
}

export interface IDashboardModel {
    metrics: IDashboardMetric[];
    queue: IDashboardQueueItem[];
    attention: IDashboardAttentionItem[];
    activity: IDashboardActivityItem[];
    fundingByOg: IDashboardFundingBar[];
    fundingByEntity: IDashboardFundingBar[];
    recentIwas: IDashboardRecentIwa[];
}

const queueRoles: WorkflowRole[] = ["pm", "hr", "ogPresident", "cfo"];
const activeViewRoute = "/all-authorizations/active";
const pendingViewRoute = "/all-authorizations/pending";

const getDateValue = (value?: string): number => {
    if (!value) {
        return 0;
    }

    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
};

const toLocalDate = (value?: string): Date | undefined => {
    const text = value?.trim();

    if (!text) {
        return undefined;
    }

    const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = dateOnlyMatch
        ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
        : new Date(text);

    return Number.isNaN(date.getTime()) ? undefined : date;
};

const isInActivePeriod = (authorization: IAuthorizationItem): boolean => {
    if (!authorization.periodStart || !authorization.periodEnd) {
        return false;
    }

    const start = toLocalDate(authorization.periodStart);
    const end = toLocalDate(authorization.periodEnd);

    if (!start || !end) {
        return false;
    }

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const periodStart = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const periodEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();

    return periodStart <= todayStart && todayStart <= periodEnd;
};

const hasEverBeenApproved = (authorization: IAuthorizationItem): boolean => {
    return !!authorization.approvedOn ||
        !!authorization.effectiveApprovedRun?.Id ||
        authorization.authorizationStatus === "approved" ||
        authorization.authorizationStatus === "closed";
};

const isActiveAuthorization = (authorization: IAuthorizationItem): boolean => {
    return hasEverBeenApproved(authorization) && isInActivePeriod(authorization);
};

const isExpiringWithinDays = (authorization: IAuthorizationItem, days: number): boolean => {
    const end = getDateValue(authorization.periodEnd);

    if (!end || !isActiveAuthorization(authorization)) {
        return false;
    }

    const diffDays = (end - Date.now()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= days;
};

const getCurrentFunding = (authorization: IAuthorizationItem): number => {
    const approved = Number(authorization.approvedGrandTotal ?? 0);
    const base = Number(authorization.baseGrandTotal ?? 0);

    return approved > 0 ? approved : base;
};

const buildBarRows = (values: Map<string, number>, limit: number): IDashboardFundingBar[] => {
    const rows = Array.from(values.entries())
        .map(([label, value]) => ({ label, value }))
        .filter((row) => row.value > 0)
        .sort((left, right) => right.value - left.value)
        .slice(0, limit);
    const max = rows[0]?.value ?? 0;

    return rows.map((row) => ({
        key: row.label,
        label: row.label,
        value: row.value,
        formattedValue: formatCurrency(row.value),
        percent: max > 0 ? Math.max(4, (row.value / max) * 100) : 0
    }));
};

const addToMap = (map: Map<string, number>, key: string | undefined, value: number): void => {
    const label = key?.trim();

    if (!label) {
        return;
    }

    map.set(label, (map.get(label) ?? 0) + value);
};

const getActionTone = (action: IWorkflowActionItem): IDashboardActivityItem["tone"] => {
    switch (action.actionType) {
        case "approved":
        case "pdfGenerated":
            return "success";
        case "rejected":
        case "returned":
        case "canceled":
            return "error";
        case "submitted":
        case "modified":
        case "restarted":
            return "warning";
        default:
            return "info";
    }
};

const formatModActivityLabel = (modTitle?: string): string | undefined => {
    const match = modTitle?.match(/MOD-(\d+)/i);

    if (!match?.[1]) {
        return undefined;
    }

    return `MOD-${match[1].padStart(2, "0")}`;
};

const formatActivityTitle = (action: IWorkflowActionItem, authorization?: IAuthorizationItem): string => {
    const title = action.authorization?.Title ?? authorization?.Title ?? "IWA";
    const modLabel = formatModActivityLabel(action.mod?.Title);
    const contractId = authorization?.contractId?.trim();
    const contractName = authorization?.contractName?.trim();
    const contractText = [
        contractId ? `Contract ID ${contractId}` : undefined,
        contractName
    ].filter(Boolean).join(" | ");
    const scopeText = modLabel ? `${title}, ${modLabel}` : title;

    return contractText ? `${scopeText} for ${contractText}` : scopeText;
};

const formatActivityDetail = (action: IWorkflowActionItem): string => {
    const actionLabel = (workflowActionLabels[action.actionType] ?? action.actionType).toLowerCase();
    const actor = action.actionBy?.Title ? ` by ${action.actionBy.Title}` : "";
    const summary = action.changeSummary?.trim();
    const sentence = `was ${actionLabel}${actor}`;

    return summary ? `${sentence} | ${summary}` : sentence;
};

export const buildDashboardModel = (
    authorizations: IAuthorizationItem[],
    draftAuthorizations: IAuthorizationItem[],
    runByAuthorizationId: Map<number, IWorkflowRunItem>,
    draftModsByAuthorizationId: Map<number, IModItem>,
    dashboardActions: IWorkflowActionItem[]
): IDashboardModel => {
    const activeAuthorizations = authorizations.filter(isActiveAuthorization);
    const activeRuns = authorizations
        .map((authorization) => runByAuthorizationId.get(authorization.Id))
        .filter((run): run is IWorkflowRunItem => !!run && run.runStatus === "active");
    const activeFunding = activeAuthorizations.reduce((total, authorization) => total + getCurrentFunding(authorization), 0);
    const expiringSoon = activeAuthorizations.filter((authorization) => isExpiringWithinDays(authorization, 60));
    const modsInProgress = activeRuns.filter((run) => run.runType === "mod").length + draftModsByAuthorizationId.size;
    const basePdfMissing = authorizations.filter((authorization) =>
        authorization.authorizationStatus === "approved" &&
        !authorization.pdfUrl
    );

    const queue = queueRoles.map((role) => ({
        role,
        label: workflowRoleLabels[role],
        count: activeRuns.filter((run) => run.pendingRole === role).length,
        route: pendingViewRoute
    }));

    const staleRuns = activeRuns.filter((run) => {
        const assigned = getDateValue(run.stepAssignedDate);
        return assigned > 0 && (Date.now() - assigned) / (1000 * 60 * 60 * 24) >= 3;
    });

    const attention: IDashboardAttentionItem[] = [
        ...staleRuns.slice(0, 3).map((run) => ({
            key: `stale-${run.Id}`,
            label: "Stale workflow",
            title: run.authorization?.Title ?? "IWA",
            detail: `${run.pendingRole ? workflowRoleLabels[run.pendingRole] : "Workflow"} pending since ${formatDate(run.stepAssignedDate, true)}`,
            route: `/authorizations/view/${run.authorization?.Id}`,
            severity: "warning" as const
        })),
        ...expiringSoon.slice(0, 3).map((authorization) => ({
            key: `expiring-${authorization.Id}`,
            label: "Expiring soon",
            title: authorization.Title,
            detail: `Period ends ${formatDate(authorization.periodEnd, false)}`,
            route: `/authorizations/view/${authorization.Id}`,
            severity: "info" as const
        })),
        ...basePdfMissing.slice(0, 3).map((authorization) => ({
            key: `pdf-${authorization.Id}`,
            label: "PDF missing",
            title: authorization.Title,
            detail: "Approved base export has not been saved.",
            route: `/authorizations/export/${authorization.Id}?export=base`,
            severity: "error" as const
        }))
    ].slice(0, 6);

    const ogFunding = new Map<string, number>();
    const entityFunding = new Map<string, number>();

    activeAuthorizations.forEach((authorization) => {
        const value = getCurrentFunding(authorization);
        addToMap(ogFunding, authorization.og, value);
        addToMap(entityFunding, authorization.receivingEntity, value);
    });

    const recentIwas = [...authorizations]
        .sort((left, right) => getDateValue(right.Modified) - getDateValue(left.Modified))
        .slice(0, 5)
        .map((authorization) => ({
            key: String(authorization.Id),
            title: authorization.Title,
            detail: `${authorizationStatusLabels[authorization.authorizationStatus]} | ${authorization.contractName ?? "No contract"}`,
            amount: formatCurrency(getCurrentFunding(authorization)),
            route: `/authorizations/view/${authorization.Id}`
        }));

    const authorizationById = new Map(authorizations.map((authorization) => [authorization.Id, authorization]));
    const activity = dashboardActions
        .slice(0, 6)
        .map((action) => {
            const authorization = action.authorization?.Id ? authorizationById.get(action.authorization.Id) : undefined;

            return {
                key: String(action.Id),
                title: formatActivityTitle(action, authorization),
                detail: formatActivityDetail(action),
                when: formatSinceDate(action.actionDate),
                route: `/authorizations/view/${action.authorization?.Id}`,
                tone: getActionTone(action)
            };
        });

    return {
        metrics: [
            {
                key: "active",
                label: "Active IWA's",
                value: String(activeAuthorizations.length),
                detail: "Approved at least once and currently in period",
                route: activeViewRoute
            },
            {
                key: "funding",
                label: "Active Funding",
                value: formatCurrency(activeFunding),
                detail: "Current approved funding across active IWA's",
                route: activeViewRoute
            },
            {
                key: "pending",
                label: "Pending Approval",
                value: String(activeRuns.length),
                detail: "Workflow steps waiting for action",
                route: pendingViewRoute
            },
            {
                key: "expiring",
                label: "Expiring Soon",
                value: String(expiringSoon.length),
                detail: "Performance periods ending within 60 days",
                route: "/all-authorizations/expiringSoon"
            },
            {
                key: "mods",
                label: "Mods In Progress",
                value: String(modsInProgress),
                detail: "Draft or active Mod workflows",
                route: "/all-authorizations/withMods"
            }
        ],
        queue,
        attention,
        activity,
        fundingByOg: buildBarRows(ogFunding, 5),
        fundingByEntity: buildBarRows(entityFunding, 5),
        recentIwas
    };
};
