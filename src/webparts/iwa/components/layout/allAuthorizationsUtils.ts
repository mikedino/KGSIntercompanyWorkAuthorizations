import {
    AuthorizationStatus,
    IAuthorizationItem,
    IModItem,
    IWorkflowRunItem,
    WorkflowRole,
    WorkflowRunStatus,
    workflowRoleLabels
} from "../data/props";
import {
    authorizationStatusLabels,
    getStatusChipColor
} from "./myWorkUtils";

export type AllAuthorizationsPresetView =
    | "all"
    | "active"
    | "expiringSoon"
    | "expiredOrClosed"
    | "rejected"
    | "withMods";

export type AllAuthorizationsSortField =
    | "title"
    | "authorizationStatus"
    | "workflowStatus"
    | "pendingRole"
    | "assignedDate"
    | "baseGrandTotal"
    | "approvedGrandTotal"
    | "modCount"
    | "periodEnd"
    | "modified";

export interface IAllAuthorizationsFilters {
    searchText: string;
    entity: string;
    og: string;
    lob: string;
}

export interface IAllAuthorizationsRow {
    authorization: IAuthorizationItem;
    currentRun?: IWorkflowRunItem;
    hasMods: boolean;
    isModDraft: boolean;
    draftMod?: IModItem;
    searchIndex: string;
}

export const workflowRunStatusLabels: Record<WorkflowRunStatus, string> = {
    active: "Active",
    completed: "Completed",
    rejected: "Rejected",
    canceled: "Canceled",
    superseded: "Superseded"
};

/**
 * Workflow chips use the same restrained palette as the authorization chips so
 * the page stays consistent with the rest of the shell.
 */
export const getWorkflowStatusChipColor = (
    status?: WorkflowRunStatus
): "default" | "success" | "warning" | "error" | "info" => {
    switch (status) {
        case "active":
            return "warning";
        case "completed":
            return "success";
        case "rejected":
        case "canceled":
            return "error";
        case "superseded":
            return "default";
        default:
            return "info";
    }
};

const activeAuthorizationStatuses: AuthorizationStatus[] = ["submitted", "underReview"];
const closedAuthorizationStatuses: AuthorizationStatus[] = ["closed", "canceled"];

const normalizeText = (value?: string): string => (value ?? "").trim().toLowerCase();

const toSearchParts = (authorization: IAuthorizationItem, run?: IWorkflowRunItem): string[] => {
    return [
        authorization.Title,
        authorization.contractName,
        authorization.contractId,
        authorization.invoice,
        authorization.donorEntity,
        authorization.receivingEntity,
        authorization.og,
        authorization.lob,
        authorization.authorizationStatus,
        authorizationStatusLabels[authorization.authorizationStatus],
        run?.runStatus,
        run ? workflowRunStatusLabels[run.runStatus] : "",
        run?.pendingRole,
        run?.pendingRole ? workflowRoleLabels[run.pendingRole] : "",
        run?.pendingApprover?.Title
    ].filter(Boolean) as string[];
};

/**
 * Build a row model once so filtering/sorting stays fast even as the page adds
 * richer status and detail cells.
 */
export const buildAllAuthorizationRows = (
    authorizations: IAuthorizationItem[],
    runByAuthorizationId: Map<number, IWorkflowRunItem>,
    draftModsByAuthorizationId: Map<number, IModItem> = new Map()
): IAllAuthorizationsRow[] => {
    return authorizations.map((authorization: IAuthorizationItem): IAllAuthorizationsRow => {
        const currentRun = runByAuthorizationId.get(authorization.Id);
        const draftMod = draftModsByAuthorizationId.get(authorization.Id);

        return {
            authorization,
            currentRun,
            hasMods: (authorization.modCount ?? 0) > 0,
            isModDraft: !!draftMod,
            draftMod,
            searchIndex: normalizeText(toSearchParts(authorization, currentRun).join(" | "))
        };
    });
};

export const getUniqueFilterValues = (
    rows: IAllAuthorizationsRow[],
    selector: (row: IAllAuthorizationsRow) => Array<string | undefined>
): string[] => {
    const values = new Set<string>();

    rows.forEach((row: IAllAuthorizationsRow): void => {
        selector(row).forEach((value?: string): void => {
            const trimmed = value?.trim();

            if (trimmed) {
                values.add(trimmed);
            }
        });
    });

    return Array.from(values).sort((a: string, b: string): number => a.localeCompare(b));
};

const isExpiringSoon = (authorization: IAuthorizationItem): boolean => {
    if (!authorization.periodEnd) {
        return false;
    }

    const today = new Date();
    const end = new Date(authorization.periodEnd);

    if (Number.isNaN(end.getTime())) {
        return false;
    }

    const diffMs = end.getTime() - today.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    return diffDays >= 0 && diffDays <= 30;
};

const isExpired = (authorization: IAuthorizationItem): boolean => {
    if (!authorization.periodEnd) {
        return false;
    }

    const end = new Date(authorization.periodEnd);

    if (Number.isNaN(end.getTime())) {
        return false;
    }

    return end.getTime() < new Date().getTime();
};

const matchesPresetView = (
    row: IAllAuthorizationsRow,
    presetView: AllAuthorizationsPresetView
): boolean => {
    switch (presetView) {
        case "active":
            return activeAuthorizationStatuses.includes(row.authorization.authorizationStatus) || row.currentRun?.runStatus === "active";
        case "expiringSoon":
            return isExpiringSoon(row.authorization);
        case "expiredOrClosed":
            return closedAuthorizationStatuses.includes(row.authorization.authorizationStatus) || isExpired(row.authorization);
        case "rejected":
            return row.authorization.authorizationStatus === "rejected" || row.currentRun?.runStatus === "rejected";
        case "withMods":
            return row.hasMods;
        case "all":
        default:
            return true;
    }
};

export const filterAllAuthorizationRows = (
    rows: IAllAuthorizationsRow[],
    presetView: AllAuthorizationsPresetView,
    filters: IAllAuthorizationsFilters
): IAllAuthorizationsRow[] => {
    const normalizedSearch = normalizeText(filters.searchText);
    const normalizedEntity = normalizeText(filters.entity);
    const normalizedOg = normalizeText(filters.og);
    const normalizedLob = normalizeText(filters.lob);

    return rows.filter((row: IAllAuthorizationsRow): boolean => {
        if (!matchesPresetView(row, presetView)) {
            return false;
        }

        if (normalizedSearch && !row.searchIndex.includes(normalizedSearch)) {
            return false;
        }

        if (normalizedEntity) {
            const donor = normalizeText(row.authorization.donorEntity);
            const receiving = normalizeText(row.authorization.receivingEntity);

            if (donor !== normalizedEntity && receiving !== normalizedEntity) {
                return false;
            }
        }

        if (normalizedOg && normalizeText(row.authorization.og) !== normalizedOg) {
            return false;
        }

        if (normalizedLob && normalizeText(row.authorization.lob) !== normalizedLob) {
            return false;
        }

        return true;
    });
};

const getDateValue = (value?: string): number => {
    if (!value) {
        return 0;
    }

    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
};

const getSortValue = (
    row: IAllAuthorizationsRow,
    sortField: AllAuthorizationsSortField
): string | number => {
    switch (sortField) {
        case "authorizationStatus":
            return authorizationStatusLabels[row.authorization.authorizationStatus];
        case "workflowStatus":
            return row.currentRun ? workflowRunStatusLabels[row.currentRun.runStatus] : "";
        case "pendingRole":
            return row.currentRun?.pendingRole ? workflowRoleLabels[row.currentRun.pendingRole as WorkflowRole] : "";
        case "assignedDate":
            return getDateValue(row.currentRun?.stepAssignedDate);
        case "baseGrandTotal":
            return row.authorization.baseGrandTotal ?? 0;
        case "approvedGrandTotal":
            return row.authorization.approvedGrandTotal ?? 0;
        case "modCount":
            return row.authorization.modCount ?? 0;
        case "periodEnd":
            return getDateValue(row.authorization.periodEnd);
        case "modified":
            return getDateValue(row.authorization.Modified);
        case "title":
        default:
            return row.authorization.Title;
    }
};

export const sortAllAuthorizationRows = (
    rows: IAllAuthorizationsRow[],
    sortField: AllAuthorizationsSortField,
    sortDirection: "asc" | "desc"
): IAllAuthorizationsRow[] => {
    const sorted = [...rows].sort((left: IAllAuthorizationsRow, right: IAllAuthorizationsRow): number => {
        const leftValue = getSortValue(left, sortField);
        const rightValue = getSortValue(right, sortField);

        if (typeof leftValue === "number" && typeof rightValue === "number") {
            return leftValue - rightValue;
        }

        return String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: "base" });
    });

    return sortDirection === "asc" ? sorted : sorted.reverse();
};

const escapeCsv = (value: string | number): string => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, "\"\"")}"`;
};

/**
 * Lightweight CSV export keeps the page self-contained without adding another
 * dependency while still giving users a usable spreadsheet handoff.
 */
export const exportAllAuthorizationRows = (
    rows: IAllAuthorizationsRow[],
    fileName: string
): void => {
    const header = [
        "Title",
        "Contract Title",
        "Contract ID",
        "Donor Entity",
        "Receiving Entity",
        "OG",
        "LOB",
        "Authorization Status",
        "Workflow Status",
        "Pending Role",
        "Assigned Date",
        "Base Grand Total",
        "Approved Grand Total",
        "Mod Count",
        "Period End",
        "Modified"
    ];

    const lines = rows.map((row: IAllAuthorizationsRow): string => {
        return [
            row.authorization.Title,
            row.authorization.contractName ?? "",
            row.authorization.contractId ?? "",
            row.authorization.donorEntity ?? "",
            row.authorization.receivingEntity ?? "",
            row.authorization.og ?? "",
            row.authorization.lob ?? "",
            authorizationStatusLabels[row.authorization.authorizationStatus],
            row.currentRun ? workflowRunStatusLabels[row.currentRun.runStatus] : "",
            row.currentRun?.pendingRole ? workflowRoleLabels[row.currentRun.pendingRole] : "",
            row.currentRun?.stepAssignedDate ?? "",
            row.authorization.baseGrandTotal ?? "",
            row.authorization.approvedGrandTotal ?? "",
            row.authorization.modCount ?? "",
            row.authorization.periodEnd ?? "",
            row.authorization.Modified ?? ""
        ].map((value: string | number) => escapeCsv(value)).join(",");
    });

    const csv = [header.map(escapeCsv).join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
};

export { authorizationStatusLabels, getStatusChipColor };
