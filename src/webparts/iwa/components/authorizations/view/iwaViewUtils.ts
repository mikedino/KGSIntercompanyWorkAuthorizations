import { SxProps, Theme } from "@mui/material/styles";
import { IAuthorizationItem, ILaborLineItem, IPeoplePicker, IResourceItem, IWorkflowActionItem, IWorkflowRunItem, WorkflowStepKey } from "../../data/props";
import { formatCurrencyInputValue } from "../../common/utils";

export type DetailTab = "summary" | "resources" | "travel" | "workflow" | "mods" | "history";

export const detailTabs: Array<{ value: DetailTab; label: string; }> = [
    { value: "summary", label: "Summary" },
    { value: "resources", label: "Resources & Labor" },
    { value: "travel", label: "Travel / ODC" },
    { value: "workflow", label: "Workflow" },
    { value: "mods", label: "Mods" },
    { value: "history", label: "History" }
];

export const baseWorkflowSteps: WorkflowStepKey[] = ["submit", "pm", "hr", "ogPresident", "cfo"];

export const contractTypeLabels: Record<IAuthorizationItem["contractType"], string> = {
    tm: "T&M",
    ffp: "FFP"
};

export const getActiveModDraftSessionKey = (authorizationId: number): string => `iwa:activeModDraft:${authorizationId}`;

export interface ICompDraft {
    annualSalary: string;
    standardRate: string;
    overtimeRate: string;
    standardHours: string;
    overtimeHours: string;
}

export interface ICompOverrideDraft {
    standardRate: boolean;
    overtimeRate: boolean;
}

export interface IResourceRosterRow {
    key: string | number;
    title: string;
    email: string;
    labels: string[];
}

export const toCompDraft = (line: ILaborLineItem): ICompDraft => ({
    annualSalary: formatCurrencyInputValue(line.annualSalary),
    standardRate: formatCurrencyInputValue(line.standardRate),
    overtimeRate: formatCurrencyInputValue(line.overtimeRate),
    standardHours: line.standardHours ? String(line.standardHours) : "",
    overtimeHours: line.overtimeHours ? String(line.overtimeHours) : ""
});

export const roundCurrency = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const isSameCurrency = (left?: number, right?: number): boolean => {
    return Math.abs(Number(left ?? 0) - Number(right ?? 0)) < 0.01;
};

export const getCompOverrideDraft = (line: ILaborLineItem): ICompOverrideDraft => {
    const annualSalary = Number(line.annualSalary ?? 0);
    const standardRate = Number(line.standardRate ?? 0);
    const overtimeRate = Number(line.overtimeRate ?? 0);
    const derivedStandardRate = annualSalary > 0 ? roundCurrency((annualSalary / 2080) * 1.65) : 0;
    const effectiveStandardRate = standardRate > 0 ? standardRate : derivedStandardRate;
    const derivedOvertimeRate = effectiveStandardRate > 0 ? roundCurrency(effectiveStandardRate * 1.5) : 0;

    return {
        standardRate: standardRate > 0 && !isSameCurrency(standardRate, derivedStandardRate),
        overtimeRate: overtimeRate > 0 && !isSameCurrency(overtimeRate, derivedOvertimeRate)
    };
};

export const getDerivedRatesFromSalary = (annualSalary: number | undefined): { standardRate: number; overtimeRate: number } => {
    const standardRate = annualSalary && annualSalary > 0 ? roundCurrency((annualSalary / 2080) * 1.65) : 0;

    return {
        standardRate,
        overtimeRate: roundCurrency(standardRate * 1.5)
    };
};

export const compactNumberInputSx: SxProps<Theme> = {
    width: 68,
    "& input": {
        textAlign: "right"
    }
};

export const compactCurrencyInputSx: SxProps<Theme> = {
    width: 102,
    "& input": {
        textAlign: "right"
    }
};

export const quietTableSx: SxProps<Theme> = {
    "& thead tr": {
        bgcolor: "background.default"
    },
    "& th": {
        fontWeight: 600,
        borderBottom: "1px solid",
        borderColor: "divider"
    },
    "& td": {
        borderBottom: "1px solid",
        borderColor: "divider"
    },
    "& tbody tr:last-child td": {
        borderBottom: 0
    }
};

export const totalsRowSx: SxProps<Theme> = {
    "& td": {
        fontWeight: 600,
        fontStyle: "italic"
    }
};

export const getCurrentStepIndex = (run?: IWorkflowRunItem): number => {
    if (!run) {
        return 0;
    }

    const index = baseWorkflowSteps.indexOf(run.currentStepKey);
    return index >= 0 ? index : 0;
};

export const getStepAction = (actions: IWorkflowActionItem[], step: WorkflowStepKey): IWorkflowActionItem | undefined => {
    if (step === "submit") {
        return actions.find((action) => action.stepKey === step && (action.actionType === "submitted" || action.actionType === "modified"));
    }

    if (step === "submitter") {
        return actions.find((action) => action.stepKey === step && (action.actionType === "returned" || action.actionType === "restarted"));
    }

    return actions.find((action) => action.stepKey === step && (action.actionType === "approved" || action.actionType === "rejected"));
};

const fallbackResourceEmail = "sharepointapps@koniag-gs.com";

export const isFallbackResourceEmployee = (resource: IResourceItem): boolean => {
    return resource.employee?.EMail?.toLowerCase() === fallbackResourceEmail;
};

export const getResourceDisplayName = (resource: IResourceItem | undefined): string => {
    if (!resource) {
        return "";
    }

    if (isFallbackResourceEmployee(resource) && resource.Title?.trim()) {
        return resource.Title.trim();
    }

    return resource.employee?.Title ?? "";
};

export const getResourceNamesForLabor = (line: ILaborLineItem, resources: IResourceItem[]): string => {
    const ids = line.resources?.results?.map((resource) => resource.Id) ?? [];
    const names = ids
        .map((id) => getResourceDisplayName(resources.find((resource) => resource.Id === id)))
        .filter(Boolean) as string[];

    return names.length ? names.join(", ") : "-";
};

export const getLaborDisplayName = (line: ILaborLineItem, resources: IResourceItem[]): string => {
    const resourceName = getResourceNamesForLabor(line, resources);
    return resourceName === "-" ? line.Title ?? "" : resourceName;
};

export const getModScopeLabel = (lineOrResource: { lineScope?: string; mod?: { Title?: string; Id?: number } }): string => {
    if (lineOrResource.lineScope === "mod") {
        return lineOrResource.mod?.Title?.replace(/^.*MOD-/i, "M") ?? "MOD";
    }

    return "BASE";
};

export const formatModLabel = (modNumber?: number): string => `M${String(modNumber ?? 0).padStart(2, "0")}`;

export const getModScopeChipColor = (lineOrResource: { lineScope?: string }): "default" | "secondary" => {
    return lineOrResource.lineScope === "mod" ? "secondary" : "default";
};

export const getWorkflowStepApprover = (
    step: WorkflowStepKey,
    authorization: IAuthorizationItem,
    run?: IWorkflowRunItem,
    modSubmitter?: IPeoplePicker
): IPeoplePicker | undefined => {
    switch (step) {
        case "pm":
            return authorization.pm;
        case "hr":
            return run?.hr;
        case "ogPresident":
            return run?.ogPresident;
        case "cfo":
            return run?.cfo;
        case "submit":
        case "submitter":
        default:
            return run?.runType === "mod" ? modSubmitter : authorization.Author;
    }
};

export const getWorkflowActionChipColor = (
    action?: IWorkflowActionItem,
    isCurrent?: boolean,
    skipped?: boolean
): "default" | "success" | "warning" | "error" | "info" => {
    if (skipped) {
        return "default";
    }

    if (isCurrent) {
        return "warning";
    }

    if (!action) {
        return "default";
    }

    if (action.actionType === "approved" || action.actionType === "submitted" || action.actionType === "modified" || action.actionType === "restarted") {
        return "success";
    }

    if (action.actionType === "rejected" || action.actionType === "returned") {
        return "error";
    }

    return "info";
};

export const getMissingCompensationMessage = (
    authorization: IAuthorizationItem | undefined,
    run: IWorkflowRunItem | undefined,
    laborLines: ILaborLineItem[]
): string | undefined => {
    if (!authorization || !run) {
        return undefined;
    }

    const requiresCompensationCheck =
        (authorization.contractType === "tm" && run.currentStepKey === "hr") ||
        (authorization.contractType === "ffp" && run.currentStepKey === "pm");

    if (!requiresCompensationCheck) {
        return undefined;
    }

    // Travel/ODC-only authorizations are valid. Only enforce compensation/lump-sum totals
    // when labor lines actually exist for the current authorization or mod.
    if (laborLines.length === 0) {
        return undefined;
    }

    const hasMissingTotal = laborLines.some((line) => Number(line.totalAmount ?? 0) <= 0);

    if (!hasMissingTotal) {
        return undefined;
    }

    return authorization.contractType === "tm"
        ? "HR must enter compensation before approving this T&M authorization. Each labor line needs a Total Amount greater than $0."
        : "The lump sum amount must be entered before approving this FFP authorization. Each labor line needs a Total Amount greater than $0.";
};
