import {
    AuthorizationStatus, ChargingPeriod, IAuthorizationItem, ILaborLineItem, IModItem, IPeoplePicker,
    IResourceItem, ITravelOdcItem, IWorkflowActionItem, IWorkflowRunItem, LaborPricingType,
    LineScope, TravelLineType, WorkflowRole, WorkflowStepKey
} from "../data/props";

/* Rolled-up money totals used by the authorization/mod summary cards and header display. */
/* This keeps the View Item page from recalculating totals directly inside the UI layer. */
export interface IAuthorizationFinancialSummary {
    baseLaborAmount: number;
    baseTravelAmount: number;
    baseGrandTotal: number;

    approvedModLaborAmount: number;
    approvedModTravelAmount: number;
    approvedModGrandTotal: number;

    effectiveLaborAmount: number;
    effectiveTravelAmount: number;
    effectiveGrandTotal: number;
}

/* Effective T&M summary row for labor displays grouped at the employee/resource level. */
/* Use this for detail grids and PDF-style summaries where hours and dollars are per employee. */
export interface IEffectiveTmSummaryRow {
    resourceId: number;
    employeeKey: string;
    employeeName: string;
    employeeEmail: string;
    state: string;
    jobId: string;
    laborCategory: string;

    baseStandardHours: number;
    baseOvertimeHours: number;
    modStandardHours: number;
    modOvertimeHours: number;
    effectiveStandardHours: number;
    effectiveOvertimeHours: number;

    baseAmount: number;
    modAmount: number;
    effectiveAmount: number;
}

/* Effective FFP summary row for labor displays grouped at the billable line level. */
/* Use this when the CFO needs employee names plus one lump-sum amount by Job and Labor Category. */
export interface IEffectiveFfpSummaryRow {
    laborLineId: number;
    jobId: string;
    laborCategory: string;
    chargingPeriod?: ChargingPeriod;
    periodQty?: number;

    employeeCount: number;
    employeeNames: string[];

    baseAmount: number;
    modAmount: number;
    effectiveAmount: number;
}

/* Roster-focused row used to display who is attached to the IWA regardless of pricing type. */
/* This is helpful for employee lists, roster tabs, and resource pickers in the UI. */
export interface IResourceRosterRow {
    resourceId: number;
    employeeKey: string;
    employeeName: string;
    employeeEmail: string;
    state: string;
    lineScope: LineScope;
    modId?: number;
    isActive: boolean;
    comments?: string;
}

/* Display-ready labor row that normalizes T&M and FFP data for grids and read-only views. */
/* Use this when the UI needs one shared labor table shape with conditional columns. */
export interface ILaborLineDisplayRow {
    laborLineId: number;
    pricingType: LaborPricingType;
    lineScope: LineScope;
    modId?: number;

    jobId: string;
    laborCategory: string;
    resourceIds: number[];
    employeeNames: string[];

    standardHours?: number;
    overtimeHours?: number;
    annualSalary?: number;
    standardRate?: number;
    overtimeRate?: number;

    chargingPeriod?: ChargingPeriod;
    periodQty?: number;
    lumpSumAmount?: number;

    totalAmount: number;
    comments?: string;
}

/* Effective travel/ODC row combining base and mod values for the authorization detail view. */
/* This supports travel summary tables and PDF export sections. */
export interface IEffectiveTravelSummaryRow {
    lineType: TravelLineType;
    jobId: string;
    description: string;
    baseAmount: number;
    modAmount: number;
    effectiveAmount: number;
}

/* Filter model for authorization list pages, dashboards, and My Work-style views. */
/* Keep this separate from list item types since it represents UI state, not stored data. */
export interface IAuthorizationFilters {
    searchText: string;
    authorizationStatus: AuthorizationStatus | "all";
    requestorId?: number; //Author
    pmId?: number;
    hrId?: number;
    ogPresidentId?: number;
    cfoId?: number;
}

/* Composite view model for the IWA detail page that assembles data from multiple lists. */
/* This is the main "read model" for rendering tabs, summaries, workflow, and related rows together. */
export interface IAuthorizationDetailViewModel {
    authorization: IAuthorizationItem;
    mods: IModItem[];

    resources: IResourceItem[];
    laborLines: ILaborLineItem[];
    travelOdcs: ITravelOdcItem[];

    workflowRuns: IWorkflowRunItem[];
    workflowActions: IWorkflowActionItem[];

    financialSummary: IAuthorizationFinancialSummary;
    rosterRows: IResourceRosterRow[];
    tmSummaryRows: IEffectiveTmSummaryRow[];
    ffpSummaryRows: IEffectiveFfpSummaryRow[];
    laborDisplayRows: ILaborLineDisplayRow[];
    travelSummaryRows: IEffectiveTravelSummaryRow[];
}

/* Work queue row used for inbox/task views where a user has an action in workflow. */
/* This keeps workflow assignment data together with the related authorization or mod context. */
export interface IMyWorkItem {
    authorization: IAuthorizationItem;
    mod?: IModItem;
    workflowRun: IWorkflowRunItem;
    currentStepKey: WorkflowStepKey;
    pendingRole?: WorkflowRole;
    pendingApprover?: IPeoplePicker;
    assignedDate?: string;
}
