/* =========================
   STATIC OPTION ARRAYS
   ========================= */

import {
    ThemeMode, AppUserRole, LineScope, TravelLineType, AuthorizationStatus,
    ModStatus, WorkflowStepKey, WorkflowActionType, WorkflowDisplayStatus,
    WorkflowRunStatus, WorkflowOutcome, WorkflowRole
} from "../data/props";

export const themeModeOptions: ThemeMode[] = ["dark", "light"];

export const appUserRoleOptions: AppUserRole[] = ["user", "admin"];

export const lineScopeOptions: LineScope[] = ["base", "mod"];

export const travelLineTypeOptions: TravelLineType[] = ["travel", "odc", "other"];

export const authorizationStatusOptions: AuthorizationStatus[] = [
    "draft",
    "submitted",
    "underReview",
    "approved",
    "rejected",
    "canceled",
    "closed",
];

export const modStatusOptions: ModStatus[] = [
    "draft",
    "submitted",
    "underReview",
    "approved",
    "rejected",
    "canceled",
];

export const workflowStepKeyOptions: WorkflowStepKey[] = [
    "submit",
    "pm",
    "hr",
    "ogPresident",
    "cfo",
    "submitter",
];

export const workflowActionTypeOptions: WorkflowActionType[] = [
    "submitted",
    "approved",
    "rejected",
    "returned",
    "restarted",
    "canceled",
    "skipped",
    "systemGenerated",
    "pdfGenerated",
];

export const workflowDisplayStatusOptions: WorkflowDisplayStatus[] = [
    "submitted",
    "approved",
    "rejected",
    "current",
    "queued",
    "skipped",
    "returned",
    "canceled",
];

export const workflowRunStatusOptions: WorkflowRunStatus[] = [
    "active",
    "completed",
    "rejected",
    "canceled",
    "superseded",
];

export const workflowOutcomeOptions: WorkflowOutcome[] = [
    "approved",
    "rejected",
    "canceled",
    "returned",
    "restarted",
    "none",
];

export const workflowRoleOptions: WorkflowRole[] = [
    "requestor",
    "pm",
    "hr",
    "ogPresident",
    "cfo",
    "admin",
    "system",
];
