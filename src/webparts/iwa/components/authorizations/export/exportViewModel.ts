import {
    IAuthorizationItem,
    ILaborLineItem,
    IModItem,
    IResourceItem,
    ITravelOdcItem,
    IWorkflowActionItem,
    workflowStepLabels,
    WorkflowStepKey
} from "../../data/props";

export type IwaExportKind = "base" | "mod";

export interface IIwaExportOption {
    key: string;
    label: string;
    kind: IwaExportKind;
    modId?: number;
    pdfUrl?: string;
    pdfGeneratedOn?: string;
}

export interface IIwaExportSummaryRow {
    jobId: string;
    laborJobTitle: string;
    travelJobTitle: string;
    previousLabor: number;
    modLabor: number;
    newLabor: number;
    previousTravel: number;
    modTravel: number;
    newTravel: number;
    previousTotal: number;
    modTotal: number;
    newTotal: number;
}

const hasMeaningfulAmount = (value: number): boolean => Math.abs(value) >= 0.005;

export const hasLaborSummaryAmount = (row: IIwaExportSummaryRow): boolean => {
    return [row.previousLabor, row.modLabor, row.newLabor].some(hasMeaningfulAmount);
};

export const hasTravelSummaryAmount = (row: IIwaExportSummaryRow): boolean => {
    return [row.previousTravel, row.modTravel, row.newTravel].some(hasMeaningfulAmount);
};

export interface IIwaExportLaborDetailRow {
    employeeName: string;
    state: string;
    jobId: string;
    laborCategory: string;
    standardHours: number;
    standardRate: number;
    stoHours: boolean;
    overtimeHours: number;
    overtimeRate: number;
    totalAmount: number;
}

export interface IIwaExportTravelDetailRow {
    lineType: string;
    jobId: string;
    description: string;
    amount: number;
}

export interface IIwaExportApprovalRow {
    stepKey: WorkflowStepKey;
    label: string;
    actionBy: string;
    actionDate?: string;
    comments?: string;
}

export interface IIwaExportViewModel {
    authorization: IAuthorizationItem;
    option: IIwaExportOption;
    mod?: IModItem;
    title: string;
    subtitle: string;
    periodStart?: string;
    periodEnd?: string;
    previousPeriodStart?: string;
    previousPeriodEnd?: string;
    requestedOn?: string;
    requestedBy?: string;
    approvedOn?: string;
    approvedBy?: string;
    reason?: string;
    rows: IIwaExportSummaryRow[];
    laborDetails: IIwaExportLaborDetailRow[];
    travelDetails: IIwaExportTravelDetailRow[];
    approvals: IIwaExportApprovalRow[];
    previousLaborTotal: number;
    modLaborTotal: number;
    newLaborTotal: number;
    previousTravelTotal: number;
    modTravelTotal: number;
    newTravelTotal: number;
    previousGrandTotal: number;
    modGrandTotal: number;
    newGrandTotal: number;
}

const isModLineFor = (modId: number): ((line: { lineScope?: string; mod?: { Id?: number } }) => boolean) => (line: { lineScope?: string; mod?: { Id?: number } }): boolean => {
    return line.lineScope === "mod" && line.mod?.Id === modId;
};

const isBaseLine = (line: { lineScope?: string }): boolean => line.lineScope !== "mod";

const sum = <T,>(items: T[], selector: (item: T) => number): number => (
    items.reduce((total, item) => total + selector(item), 0)
);

const getLaborAmount = (line: ILaborLineItem): number => Number(line.totalAmount ?? 0);
const getTravelAmount = (line: ITravelOdcItem): number => Number(line.amount ?? 0);
const getJobId = (line: { jobId?: string }): string => line.jobId?.trim() || "Unassigned";
const getJobTitle = (line: { jobTitle?: string }): string => line.jobTitle?.trim() ?? "";

const addToMap = (map: Map<string, number>, key: string, value: number): void => {
    map.set(key, (map.get(key) ?? 0) + value);
};

const buildAmountMap = <T extends { jobId?: string }>(items: T[], selector: (item: T) => number): Map<string, number> => {
    const map = new Map<string, number>();
    items.forEach((item) => addToMap(map, getJobId(item), selector(item)));
    return map;
};

const buildJobTitleMap = <T extends { jobId?: string; jobTitle?: string }>(items: T[]): Map<string, string> => {
    const map = new Map<string, string>();

    items.forEach((item) => {
        const jobId = getJobId(item);
        const jobTitle = getJobTitle(item);

        if (jobTitle && !map.has(jobId)) {
            map.set(jobId, jobTitle);
        }
    });

    return map;
};

const parseDateChange = (mod: IModItem, actions: IWorkflowActionItem[]): { previousPeriodStart?: string; previousPeriodEnd?: string } => {
    const action = actions.find((item) =>
        item.mod?.Id === mod.Id &&
        (item.actionType === "submitted" || item.actionType === "modified") &&
        !!item.changePayloadJson
    );

    if (!action?.changePayloadJson) {
        return {};
    }

    try {
        const payload = JSON.parse(action.changePayloadJson) as {
            before?: { authorization?: { periodStart?: string; periodEnd?: string } };
        };

        return {
            previousPeriodStart: payload.before?.authorization?.periodStart,
            previousPeriodEnd: payload.before?.authorization?.periodEnd
        };
    } catch {
        return {};
    }
};

const findSubmitAction = (mod: IModItem | undefined, actions: IWorkflowActionItem[]): IWorkflowActionItem | undefined => {
    return actions.find((item) =>
        (item.actionType === "submitted" || item.actionType === "modified") &&
        (mod ? item.mod?.Id === mod.Id : !item.mod?.Id)
    );
};

const findCfoApprovalAction = (mod: IModItem | undefined, actions: IWorkflowActionItem[]): IWorkflowActionItem | undefined => {
    return actions.find((item) =>
        item.actionType === "approved" &&
        item.stepKey === "cfo" &&
        (mod ? item.mod?.Id === mod.Id : !item.mod?.Id)
    );
};

const getApprovedPriorMods = (mods: IModItem[], mod: IModItem): IModItem[] => {
    return mods.filter((item) =>
        item.modStatus === "approved" &&
        (item.modNumber ?? 0) < (mod.modNumber ?? 0)
    );
};

export const formatExportModLabel = (modNumber?: number): string => {
    const value = Number(modNumber ?? 0);
    const normalized = Number.isFinite(value) && value > 0 ? value : 0;

    return `MOD-${String(normalized).padStart(2, "0")}`;
};

const exportModStatusLabels: Record<IModItem["modStatus"], string> = {
    draft: "Draft",
    submitted: "Submitted",
    underReview: "Under Review",
    approved: "Approved",
    rejected: "Rejected",
    canceled: "Canceled"
};

const getExportOptionLabel = (mod: IModItem): string => `${formatExportModLabel(mod.modNumber)} ${exportModStatusLabels[mod.modStatus]}`;

const stepOrder: WorkflowStepKey[] = ["pm", "hr", "ogPresident", "cfo"];

const buildLaborDetails = (laborLines: ILaborLineItem[], resources: IResourceItem[]): IIwaExportLaborDetailRow[] => {
    const resourcesById = new Map(resources.map((resource) => [resource.Id, resource]));
    const resourcesByLineNumber = new Map(resources.map((resource) => [resource.lineNumber, resource]));

    return [...laborLines]
        .sort((left, right) => (left.displayOrder ?? left.lineNumber ?? 0) - (right.displayOrder ?? right.lineNumber ?? 0))
        .map((line) => {
            const resourceId = line.resources?.results?.[0]?.Id;
            const resource = resourceId ? resourcesById.get(resourceId) : resourcesByLineNumber.get(line.lineNumber);

            return {
                employeeName: resource?.employee?.Title ?? line.Title ?? "Unassigned",
                state: resource?.state ?? "-",
                jobId: getJobId(line),
                laborCategory: resource?.laborCategory ?? "-",
                standardHours: Number(line.standardHours ?? 0),
                standardRate: Number(line.standardRate ?? 0),
                stoHours: !!line.stoHours,
                overtimeHours: Number(line.overtimeHours ?? 0),
                overtimeRate: Number(line.overtimeRate ?? 0),
                totalAmount: getLaborAmount(line)
            };
        });
};

const buildTravelDetails = (travelOdcs: ITravelOdcItem[]): IIwaExportTravelDetailRow[] => {
    return [...travelOdcs]
        .sort((left, right) => (left.displayOrder ?? left.lineNumber ?? 0) - (right.displayOrder ?? right.lineNumber ?? 0))
        .map((line) => ({
            lineType: (line.lineType ?? "travel").toUpperCase(),
            jobId: getJobId(line),
            description: line.description || "-",
            amount: getTravelAmount(line)
        }));
};

const buildApprovalRows = (mod: IModItem | undefined, actions: IWorkflowActionItem[]): IIwaExportApprovalRow[] => {
    const matchingActions = actions.filter((item) =>
        (mod ? item.mod?.Id === mod.Id : !item.mod?.Id) &&
        ["approved", "skipped"].includes(item.actionType)
    );
    const latestByStep = new Map<WorkflowStepKey, IWorkflowActionItem>();

    matchingActions.forEach((action) => {
        const existing = latestByStep.get(action.stepKey);

        if (!existing || (action.actionDate ?? "") > (existing.actionDate ?? "")) {
            latestByStep.set(action.stepKey, action);
        }
    });

    return stepOrder
        .reduce<IIwaExportApprovalRow[]>((rows, stepKey) => {
            const action = latestByStep.get(stepKey);

            if (action) {
                rows.push({
                    stepKey,
                    label: workflowStepLabels[stepKey],
                    actionBy: action.actionBy?.Title ?? "-",
                    actionDate: action.actionDate,
                    comments: action.comments
                });
            }

            return rows;
        }, []);
};

export const buildIwaExportOptions = (
    authorization: IAuthorizationItem,
    mods: IModItem[]
): IIwaExportOption[] => {
    const options: IIwaExportOption[] = [{
        key: "base",
        label: "Base IWA",
        kind: "base",
        pdfUrl: authorization.pdfUrl,
        pdfGeneratedOn: authorization.pdfGeneratedOn
    }];

    [...mods]
        .sort((left, right) => (left.modNumber ?? 0) - (right.modNumber ?? 0))
        .forEach((mod) => {
            options.push({
                key: `mod-${mod.Id}`,
                label: getExportOptionLabel(mod),
                kind: "mod",
                modId: mod.Id,
                pdfUrl: mod.pdfUrl,
                pdfGeneratedOn: mod.pdfGeneratedOn
            });
        });

    return options;
};

export const getLatestIwaExportOption = (
    authorization: IAuthorizationItem,
    mods: IModItem[]
): IIwaExportOption => {
    const options = buildIwaExportOptions(authorization, mods);
    return options[options.length - 1];
};

export const buildIwaExportViewModel = (
    authorization: IAuthorizationItem,
    mods: IModItem[],
    laborLines: ILaborLineItem[],
    travelOdcs: ITravelOdcItem[],
    actions: IWorkflowActionItem[],
    resources: IResourceItem[] = [],
    selectedKey?: string
): IIwaExportViewModel => {
    const options = buildIwaExportOptions(authorization, mods);
    const option = options.find((item) => item.key === selectedKey) ?? getLatestIwaExportOption(authorization, mods);
    const mod = option.modId ? mods.find((item) => item.Id === option.modId) : undefined;

    const baseLaborLines = laborLines.filter((line) => line.isActive !== false && isBaseLine(line));
    const baseTravelLines = travelOdcs.filter((line) => line.isActive !== false && isBaseLine(line));
    const priorMods = mod ? getApprovedPriorMods(mods, mod) : [];
    const priorModIds = new Set(priorMods.map((item) => item.Id));
    const priorModLaborLines = laborLines.filter((line) => line.isActive !== false && line.lineScope === "mod" && !!line.mod?.Id && priorModIds.has(line.mod.Id));
    const priorModTravelLines = travelOdcs.filter((line) => line.isActive !== false && line.lineScope === "mod" && !!line.mod?.Id && priorModIds.has(line.mod.Id));
    const currentModLaborLines = mod ? laborLines.filter((line) => line.isActive !== false && isModLineFor(mod.Id)(line)) : baseLaborLines;
    const currentModTravelLines = mod ? travelOdcs.filter((line) => line.isActive !== false && isModLineFor(mod.Id)(line)) : baseTravelLines;
    const currentResources = mod
        ? resources.filter((resource) => resource.isActive !== false && resource.lineScope === "mod" && resource.mod?.Id === mod.Id)
        : resources.filter((resource) => resource.isActive !== false && resource.lineScope !== "mod");

    const previousLaborLines = mod ? [...baseLaborLines, ...priorModLaborLines] : [];
    const previousTravelLines = mod ? [...baseTravelLines, ...priorModTravelLines] : [];
    const previousLaborByJob = buildAmountMap(previousLaborLines, getLaborAmount);
    const previousTravelByJob = buildAmountMap(previousTravelLines, getTravelAmount);
    const modLaborByJob = buildAmountMap(currentModLaborLines, getLaborAmount);
    const modTravelByJob = buildAmountMap(currentModTravelLines, getTravelAmount);
    const laborTitleByJob = buildJobTitleMap([...currentModLaborLines, ...previousLaborLines]);
    const travelTitleByJob = buildJobTitleMap([...currentModTravelLines, ...previousTravelLines]);
    const jobIds = Array.from(new Set([
        ...previousLaborByJob.keys(),
        ...previousTravelByJob.keys(),
        ...modLaborByJob.keys(),
        ...modTravelByJob.keys()
    ])).sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
    const rows = jobIds.map((jobId) => {
        const previousLabor = previousLaborByJob.get(jobId) ?? 0;
        const previousTravel = previousTravelByJob.get(jobId) ?? 0;
        const modLabor = modLaborByJob.get(jobId) ?? 0;
        const modTravel = modTravelByJob.get(jobId) ?? 0;
        const newLabor = previousLabor + modLabor;
        const newTravel = previousTravel + modTravel;

        return {
            jobId,
            laborJobTitle: laborTitleByJob.get(jobId) ?? "",
            travelJobTitle: travelTitleByJob.get(jobId) ?? "",
            previousLabor,
            modLabor,
            newLabor,
            previousTravel,
            modTravel,
            newTravel,
            previousTotal: previousLabor + previousTravel,
            modTotal: modLabor + modTravel,
            newTotal: newLabor + newTravel
        };
    });
    const periodChange = mod ? parseDateChange(mod, actions) : {};
    const submitAction = findSubmitAction(mod, actions);
    const approvalAction = findCfoApprovalAction(mod, actions);

    return {
        authorization,
        option,
        mod,
        title: authorization.Title,
        subtitle: mod ? "IWA Modification Export" : "Intercompany Work Authorization Export",
        periodStart: authorization.periodStart,
        periodEnd: authorization.periodEnd,
        previousPeriodStart: periodChange.previousPeriodStart,
        previousPeriodEnd: periodChange.previousPeriodEnd,
        requestedOn: submitAction?.actionDate ?? authorization.Created,
        requestedBy: submitAction?.actionBy?.Title ?? authorization.Author?.Title,
        approvedOn: approvalAction?.actionDate ?? mod?.approvedOn ?? authorization.approvedOn,
        approvedBy: approvalAction?.actionBy?.Title,
        reason: mod?.reason || mod?.changeSummary,
        rows,
        laborDetails: buildLaborDetails(currentModLaborLines, currentResources),
        travelDetails: buildTravelDetails(currentModTravelLines),
        approvals: buildApprovalRows(mod, actions),
        previousLaborTotal: sum(rows, (row) => row.previousLabor),
        modLaborTotal: sum(rows, (row) => row.modLabor),
        newLaborTotal: sum(rows, (row) => row.newLabor),
        previousTravelTotal: sum(rows, (row) => row.previousTravel),
        modTravelTotal: sum(rows, (row) => row.modTravel),
        newTravelTotal: sum(rows, (row) => row.newTravel),
        previousGrandTotal: sum(rows, (row) => row.previousTotal),
        modGrandTotal: sum(rows, (row) => row.modTotal),
        newGrandTotal: sum(rows, (row) => row.newTotal)
    };
};
