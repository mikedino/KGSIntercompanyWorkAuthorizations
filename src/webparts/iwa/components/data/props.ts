import { WebPartContext } from "@microsoft/sp-webpart-base";
import { IPersonaProps } from "@fluentui/react/lib/Persona";

/* =========================
   APP ROOT
   ========================= */

export interface IIwaAppProps {
  description: string;
  context: WebPartContext;
}

export interface ILookupItem {
  Id: number;
  Title?: string;
}

export interface IPeoplePicker extends IPersonaProps {
  EMail: string;
  Id: number;
  Title: string;
}

/* =========================
   SHARED / COMMON
   ========================= */

export type ThemeMode = "dark" | "light";
export type AppUserRole = "user" | "admin" | "hr";
export type LineScope = "base" | "mod";
export type TravelLineType = "travel" | "odc" | "other";
export type ContractType = "tm" | "ffp";
export type ChargingPeriod = "monthly" | "quarterly" | "yearly";
export type LaborPricingType = "tm" | "ffp";

export type AuthorizationStatus =
  | "draft"
  | "submitted"
  | "underReview"
  | "approved"
  | "rejected"
  | "canceled"
  | "closed";

export type ModStatus =
  | "draft"
  | "submitted"
  | "underReview"
  | "approved"
  | "rejected"
  | "canceled";

export type RunType = "base" | "mod";
export type ExportType = "base" | "mod";

export type WorkflowRunStatus =
  | "active"
  | "completed"
  | "rejected"
  | "canceled"
  | "superseded";

export type WorkflowOutcome =
  | "approved"
  | "rejected"
  | "canceled"
  | "returned"
  | "restarted"
  | "none";

export type WorkflowStepKey =
  | "submit"
  | "pm"
  | "hr"
  | "ogPresident"
  | "cfo"
  | "submitter";

export type WorkflowActionType =
  | "submitted"
  | "modified"
  | "approved"
  | "rejected"
  | "returned"
  | "restarted"
  | "canceled"
  | "skipped"
  | "systemGenerated"
  | "pdfGenerated";

export type WorkflowDisplayStatus =
  | "submitted"
  | "approved"
  | "rejected"
  | "current"
  | "queued"
  | "skipped"
  | "returned"
  | "canceled";

export type WorkflowRole =
  | "requestor"
  | "pm"
  | "hr"
  | "ogPresident"
  | "cfo"
  | "admin"
  | "system";

export type AuthorizationViewTab =
  | "summary"
  | "resources"
  | "travel"
  | "workflow"
  | "mods"
  | "history";

export interface ISystemFields {
  readonly Id: number;
  Title?: string;
  Created?: string;
  Modified?: string;
  Author?: IPeoplePicker;
  Editor?: IPeoplePicker;
}

export interface IWorkflowStepDisplayItem {
  key: WorkflowStepKey;
  label: string;
  role: WorkflowRole;
  status: WorkflowDisplayStatus;
  person?: IPeoplePicker;
  actionDate?: string;
  comments?: string;
}

/* =========================
   APP USER + ROLE + BACKUP
   ========================= */

export interface IAppUserItem extends ISystemFields {
  user: IPeoplePicker;
  modePreference: ThemeMode;
  role: AppUserRole;
  lastVisit?: string;
  visitCount?: number;
  hasBackup?: boolean;
  backups: { results: IPeoplePicker[] };
}

/* =========================
   NUMBERING COUNTER
   ========================= */

export interface ICounterItem extends ISystemFields {
  Title: string; // year
  currentId: number; // last authorization ID that consumed a number
  currentSeq: number; // last allocated sequence
  nextSeq: number; // next available sequence (authoritative)
  __metadata?: {
    etag?: string;
  };
}

/* =========================
   CORE LOOKUP LISTS
   ========================= */

export interface IContractItem {
  readonly Id: number;
  Title: string;
  field_19: string; // Contract ID (e.g. 100158)
  field_20: string; // Contract Title
  field_35: string; // Customer Contract Code (e.g. 19AQMM21D0121)
  field_21: string; // Manager 1 Email (Project Manager)
  field_23: string; // Manager 1 Name (Project Manager)
  field_73: string; // NAICS Code (e.g. 541519)
  field_75: string; // OG
  field_16: string; // Completion Date (NOT USED - EMPTY)
}

export interface IInvoiceItem {
  readonly Id: number;
  Title: string;
  field_49: string; // Contract ID (e.g. 100158)
  field_28: string; // Customer Contract Code (e.g. 19AQMM21D0121)
  field_14: string; // Invoice ID 1 (e.g. 0003, 0001)
  InvoiceID1: string; // "ContractID-InvoiceID" (e.g. 100158-0001, 100158-0003, 100158-HIS1)
  field_42: string; // Invoice Title (e.g. "DOS 3451 OP4 OBO ASMB")
}

export interface IJobItem {
  readonly Id: number;
  field_13: string; // Direct Job ID (e.g. 100158-0002-0001-0001) 100158-0002-0000-0001
  field_19: string; // Direct Job Title (e.g. "DOS 3451 OP3 3001 Labor")
}

export interface IOgItem {
  readonly Id: number;
  Title: string;
  president: IPeoplePicker;
  lob: ILookupItem;
  CM: IPeoplePicker;
  SCM?: IPeoplePicker;
  // Hierarchy
  ogType: "OG" | "SrOG";
  parentOg?: ILookupItem;   // set on child OGs; lookup resolves to the SrOG row (and its president)
  isActive: boolean;
  isSelectable: boolean;
}

export interface ILobItem {
  readonly Id: number;
  Title: string;
  coo: IPeoplePicker;
}

export interface IEntityItem {
  readonly Id: number;
  Title: string;
  abbr: string;
  GM: IPeoplePicker;
  combinedTitle: string;
}

export interface IConfigItem {
  readonly Id: number;
  Title: string;
  IsFor: string;
  User?: IPeoplePicker;
  Acronym?: string;
}


/* =========================
   AUTHORIZATIONS
   ========================= */

export interface IAuthorizationItem extends ISystemFields {
  Title: string; //IWA-receivingEntityAbbr-donorEntityAbbr-year-trackingNo
  authorizationStatus: AuthorizationStatus;

  pm?: IPeoplePicker;
  backupRequestor?: IPeoplePicker;

  donorEntity: string; //Entity A
  donorEntityAbbr?: string;
  donorGm?: IPeoplePicker;
  receivingEntity: string; //Entity B
  receivingEntityAbbr?: string;
  receivingGm?: IPeoplePicker;
  og?: string;
  lob?: string;

  contractName: string;
  contractId: string;
  iwaJamisProjectId?: string;
  customerContractCode?: string;
  invoice: string;
  contractType: ContractType;
  periodStart?: string;
  periodEnd?: string;

  scopeOfWork?: string;
  justification?: string;
  notes?: string;

  baseLaborAmount?: number;
  baseTravelAmount?: number;
  baseGrandTotal?: number;
  approvedLaborAmount?: number;
  approvedTravelAmount?: number;
  approvedGrandTotal?: number;

  modCount?: number;
  currentWorkflowRun?: ILookupItem;
  effectiveApprovedRun?: ILookupItem;

  pdfUrl?: string;
  pdfGeneratedOn?: string;

  approvedOn?: string;
  rejectedOn?: string;
  canceledOn?: string;
  closedOn?: string;
}

/* =========================
   MODS
   ========================= */

export interface IModItem extends ISystemFields {
  authorization: ILookupItem;
  modNumber: number;
  modStatus: ModStatus;

  reason?: string;
  changeSummary?: string;
  notes?: string;

  laborAmount?: number;
  travelAmount?: number;
  grandTotal?: number;

  currentWorkflowRun?: ILookupItem;
  effectiveApprovedRun?: ILookupItem;

  pdfUrl?: string;
  pdfGeneratedOn?: string;

  approvedOn?: string;
  rejectedOn?: string;
  canceledOn?: string;
}

/* =========================
   RESOURCES - employees listed on the IWA regardless of T&M vs FFP
   ========================= */

export interface IResourceItem extends ISystemFields {
  authorization: ILookupItem;
  mod?: ILookupItem;

  lineScope: LineScope; // base | mod
  lineNumber?: number;
  displayOrder?: number;
  isActive?: boolean;

  employee: IPeoplePicker;
  state: string;
  laborCategory: string;
  comments?: string;
}

/* =========================
   LABORLINE - actual billable labor charge lines used for CFO/PDF/totals
   ========================= */

export interface ILaborLineItem extends ISystemFields {
  authorization: ILookupItem;
  mod?: ILookupItem;
  lineScope: LineScope;
  lineNumber?: number;
  displayOrder?: number;
  isActive?: boolean;

  pricingType: LaborPricingType;
  jobId: string;

  /* employee linkage: one employee for T&M, many employees may roll up to one FFP line */
  resources?: { results: ILookupItem[] };  // lookup auto-filled from Resource line(s)

  /* T&M fields */
  annualSalary?: number;
  standardRate?: number;
  overtimeRate?: number;
  standardHours?: number;
  stoHours?: boolean;
  overtimeHours?: number;
  standardAmount?: number;
  overtimeAmount?: number;

  /* FFP fields */
  chargingPeriod?: ChargingPeriod;
  periodQty?: number;
  lumpSumAmount?: number;

  totalAmount?: number;
  comments?: string;
}

/* =========================
   TRAVEL / ODC
   ========================= */

export interface ITravelOdcItem extends ISystemFields {
  authorization: ILookupItem;
  mod?: ILookupItem;
  lineScope: LineScope; // base | mod
  lineNumber?: number;
  displayOrder?: number;
  isActive?: boolean;

  lineType: TravelLineType;
  jobId: string;
  description?: string;
  amount: number;
  comments?: string;
}

/* =========================
   WORKFLOW RUNS
   ========================= */

export interface IWorkflowRunItem extends ISystemFields {
  authorization: ILookupItem;
  mod?: ILookupItem;
  runNumber: number;
  runType: RunType;
  runStatus: WorkflowRunStatus;
  hasDecision?: boolean;
  outcome?: WorkflowOutcome;

  currentStepKey: WorkflowStepKey;
  pendingRole?: WorkflowRole;
  pendingApprover?: IPeoplePicker;
  stepAssignedDate?: string;
  completedOn?: string;
  skipPmStep?: boolean;
  restartReason?: string;
  restartComment?: string;

  hr?: IPeoplePicker;
  ogPresident?: IPeoplePicker;
  cfo?: IPeoplePicker;

  approvedSnapshotJson?: string;

  // FLOW NOTIFICATION USE
  bicNotifiedOn: string; // datetime
  bicNotifiedTo: string // auditing/troubleshooting
}

/* =========================
   WORKFLOW ACTIONS
   ========================= */

export interface IWorkflowActionItem extends ISystemFields {
  authorization: ILookupItem;
  mod?: ILookupItem;
  workflowRun: ILookupItem;
  stepKey: WorkflowStepKey;
  actionType: WorkflowActionType;
  actionBy?: IPeoplePicker;
  actionDate: string;
  role?: WorkflowRole;
  comments?: string;
  fromStepKey?: WorkflowStepKey;
  toStepKey?: WorkflowStepKey;
  wasSkipped?: boolean;
  skipReason?: string;
  changeSummary?: string;
  changePayloadJson?: string;
}

/* =========================
   IWA EXPORTS
   ========================= */

export interface IExportItem extends ISystemFields {
  authorization: ILookupItem;
  mod?: ILookupItem;
  workflowRun?: ILookupItem;

  exportType: ExportType;
  exportLabel?: string;
  modNumber?: number;

  contractId?: string;
  taskOrderNumber?: string;
  donorEntity?: string;
  receivingEntity?: string;

  laborAmount?: number;
  travelAmount?: number;
  thisTotal?: number;
  previousTotal?: number;
  newTotal?: number;

  approvedOn?: string;
  generatedOn?: string;

  readonly FileRef?: string;
  readonly UniqueId: string;  //GUID
  readonly FileLeafRef: string; //filename
  readonly EncodedAbsUrl: string; //direct file path
  readonly ServerRedirectedEmbedUrl: string;
  readonly File_x0020_Type: string;
}

/* =========================
   HELPERS
   ========================= */

export const workflowStepLabels: Record<WorkflowStepKey, string> = {
  submit: "Submitted",
  pm: "PM Review",
  hr: "HR Review",
  ogPresident: "OGP Review",
  cfo: "CFO Review",
  submitter: "Returned to Submitter",
};

export const workflowRoleLabels: Record<WorkflowRole, string> = {
  requestor: "Requestor",
  pm: "PM",
  hr: "HR",
  ogPresident: "OG President",
  cfo: "CFO",
  admin: "Admin",
  system: "System",
};
