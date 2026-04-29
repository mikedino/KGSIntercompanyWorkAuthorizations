import { Helper, SPTypes } from "gd-sprest";
import Strings from "../common/strings";

/** SharePoint assets for the current site - installed on first run */
export const Configuration = Helper.SPConfig({
  ListCfg: [
    /* =========================
       IWA AUTHORIZATIONS
       ========================= */
    {
      ListInformation: {
        Title: Strings.Sites.main.lists.Authorizations,
        Description: "*DO NOT DELETE* Header/master records for Intercompany Work Authorizations (IWA).",
        BaseTemplate: SPTypes.ListTemplateType.GenericList,
        OnQuickLaunch: false,
        // Hidden: true
      },
      TitleFieldDisplayName: "Authorization Number",
      CustomFields: [
        {
          name: "authorizationStatus",
          title: "Authorization Status",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["draft", "submitted", "underReview", "approved", "rejected", "canceled", "closed"],
          defaultValue: "draft",
          multi: false
        } as Helper.IFieldInfoChoice,
        {
          name: "backupRequestor",
          title: "Backup Requestor",
          type: Helper.SPCfgFieldType.User,
          required: false
        } as Helper.IFieldInfoUser,
        {
          name: "pm",
          title: "PM",
          type: Helper.SPCfgFieldType.User
        } as Helper.IFieldInfoUser,
        {
          name: "donorEntity",
          title: "Donor Entity",
          type: Helper.SPCfgFieldType.Text,
          required: true,
          indexed: true
        },
        {
          name: "donorEntityAbbr",
          title: "Donor Entity Abbr",
          type: Helper.SPCfgFieldType.Text
        },
        {
          name: "donorGm",
          title: "Donor GM",
          type: Helper.SPCfgFieldType.User
        } as Helper.IFieldInfoUser,
        {
          name: "receivingEntity",
          title: "Receiving Entity",
          type: Helper.SPCfgFieldType.Text,
          required: true,
          indexed: true
        },
        {
          name: "receivingEntityAbbr",
          title: "Receiving Entity Abbr",
          type: Helper.SPCfgFieldType.Text
        },
        {
          name: "receivingGm",
          title: "Receiving GM",
          type: Helper.SPCfgFieldType.User
        } as Helper.IFieldInfoUser,
        {
          name: "contractName",
          title: "Contract Name",
          type: Helper.SPCfgFieldType.Text,
          required: true
        },
        {
          name: "contractId",
          title: "Contract ID",
          type: Helper.SPCfgFieldType.Text,
          required: true,
          indexed: true
        },
        {
          name: "invoice",
          title: "Invoice",
          type: Helper.SPCfgFieldType.Text,
          indexed: true
        },
        {
          name: "contractType",
          title: "Contract Type",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["tm", "ffp"],
          defaultValue: "tm"
        } as Helper.IFieldInfoChoice,
        {
          name: "og",
          title: "OG",
          type: Helper.SPCfgFieldType.Text,
          indexed: true
        },
        {
          name: "lob",
          title: "LOB",
          type: Helper.SPCfgFieldType.Text,
        },
        {
          name: "periodStart",
          title: "Period Start",
          type: Helper.SPCfgFieldType.Date,
          format: SPTypes.DateFormat.DateOnly
        } as Helper.IFieldInfoDate,
        {
          name: "periodEnd",
          title: "Period End",
          type: Helper.SPCfgFieldType.Date,
          format: SPTypes.DateFormat.DateOnly
        } as Helper.IFieldInfoDate,

        {
          name: "scopeOfWork",
          title: "Scope Of Work",
          type: Helper.SPCfgFieldType.Note,
          noteType: SPTypes.FieldNoteType.TextOnly
        } as Helper.IFieldInfoNote,
        {
          name: "justification",
          title: "Justification",
          type: Helper.SPCfgFieldType.Note,
          noteType: SPTypes.FieldNoteType.TextOnly
        } as Helper.IFieldInfoNote,
        {
          name: "notes",
          title: "Notes",
          type: Helper.SPCfgFieldType.Note,
          noteType: SPTypes.FieldNoteType.TextOnly
        } as Helper.IFieldInfoNote,

        {
          name: "baseLaborAmount",
          title: "Base Labor Amount",
          type: Helper.SPCfgFieldType.Currency,
          decimals: 2,
          defaultValue: "0"
        } as Helper.IFieldInfoCurrency,
        {
          name: "baseTravelAmount",
          title: "Base Travel Amount",
          type: Helper.SPCfgFieldType.Currency,
          decimals: 2,
          defaultValue: "0"
        } as Helper.IFieldInfoCurrency,
        {
          name: "baseGrandTotal",
          title: "Base Grand Total",
          type: Helper.SPCfgFieldType.Currency,
          decimals: 2,
          defaultValue: "0"
        } as Helper.IFieldInfoCurrency,

        {
          name: "approvedLaborAmount",
          title: "Approved Labor Amount",
          type: Helper.SPCfgFieldType.Currency,
          decimals: 2,
          defaultValue: "0"
        } as Helper.IFieldInfoCurrency,
        {
          name: "approvedTravelAmount",
          title: "Approved Travel Amount",
          type: Helper.SPCfgFieldType.Currency,
          decimals: 2,
          defaultValue: "0"
        } as Helper.IFieldInfoCurrency,
        {
          name: "approvedGrandTotal",
          title: "Approved Grand Total",
          type: Helper.SPCfgFieldType.Currency,
          decimals: 2,
          defaultValue: "0"
        } as Helper.IFieldInfoCurrency,

        {
          name: "modCount",
          title: "Mod Count",
          type: Helper.SPCfgFieldType.Number,
          decimals: 0,
          defaultValue: "0"
        } as Helper.IFieldInfoNumber,

        {
          name: "currentWorkflowRun",
          title: "Current Workflow Run",
          type: Helper.SPCfgFieldType.Lookup,
          listName: Strings.Sites.main.lists.WorkflowRuns,
          showField: "ID"
        } as Helper.IFieldInfoLookup,
        {
          name: "effectiveApprovedRun",
          title: "Effective Approved Run",
          type: Helper.SPCfgFieldType.Lookup,
          listName: Strings.Sites.main.lists.WorkflowRuns,
          showField: "ID"
        } as Helper.IFieldInfoLookup,

        {
          name: "pdfUrl",
          title: "PDF Url",
          type: Helper.SPCfgFieldType.Text
        },
        {
          name: "pdfGeneratedOn",
          title: "PDF Generated On",
          type: Helper.SPCfgFieldType.Date,
          format: SPTypes.DateFormat.DateTime
        } as Helper.IFieldInfoDate,
        {
          name: "approvedOn",
          title: "Approved On",
          type: Helper.SPCfgFieldType.Date,
          format: SPTypes.DateFormat.DateTime
        } as Helper.IFieldInfoDate,
        {
          name: "rejectedOn",
          title: "Rejected On",
          type: Helper.SPCfgFieldType.Date,
          format: SPTypes.DateFormat.DateTime
        } as Helper.IFieldInfoDate,
        {
          name: "canceledOn",
          title: "Canceled On",
          type: Helper.SPCfgFieldType.Date,
          format: SPTypes.DateFormat.DateTime
        } as Helper.IFieldInfoDate,
        {
          name: "closedOn",
          title: "Closed On",
          type: Helper.SPCfgFieldType.Date,
          format: SPTypes.DateFormat.DateTime
        } as Helper.IFieldInfoDate
      ],
      ViewInformation: [
        {
          ViewName: "All Items",
          Default: true,
          ViewQuery: `
            <OrderBy>
              <FieldRef Name="Modified" Ascending="FALSE"/>
            </OrderBy>`,
          ViewFields: [
            "LinkTitle",
            "authorizationStatus",
            "Author",
            "pm",
            "contractId",
            "invoice",
            "receivingEntity",
            "approvedGrandTotal",
            "modCount",
            "Modified"
          ]
        }
      ]
    },

    /* =========================
       IWA MODS
       ========================= */
    {
      ListInformation: {
        Title: Strings.Sites.main.lists.Mods,
        Description: "*DO NOT DELETE* Modification header records for approved IWA authorizations.",
        BaseTemplate: SPTypes.ListTemplateType.GenericList,
        OnQuickLaunch: false
      },
      TitleFieldDisplayName: "Mod Label",
      CustomFields: [
        {
          name: "authorization",
          title: "Authorization",
          type: Helper.SPCfgFieldType.Lookup,
          listName: Strings.Sites.main.lists.Authorizations,
          showField: "ID",
          required: true,
          indexed: true
        } as Helper.IFieldInfoLookup,
        {
          name: "modNumber",
          title: "Mod Number",
          type: Helper.SPCfgFieldType.Number,
          decimals: 0,
          required: true,
          indexed: true
        } as Helper.IFieldInfoNumber,
        {
          name: "modStatus",
          title: "Mod Status",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["draft", "submitted", "underReview", "approved", "rejected", "canceled"],
          defaultValue: "draft",
          multi: false,
          indexed: true
        } as Helper.IFieldInfoChoice,
        {
          name: "reason",
          title: "Reason",
          type: Helper.SPCfgFieldType.Note,
          noteType: SPTypes.FieldNoteType.TextOnly
        } as Helper.IFieldInfoNote,
        {
          name: "changeSummary",
          title: "Change Summary",
          type: Helper.SPCfgFieldType.Note,
          noteType: SPTypes.FieldNoteType.TextOnly
        } as Helper.IFieldInfoNote,
        {
          name: "notes",
          title: "Notes",
          type: Helper.SPCfgFieldType.Note,
          noteType: SPTypes.FieldNoteType.TextOnly
        } as Helper.IFieldInfoNote,
        {
          name: "approvedOn",
          title: "Approved On",
          type: Helper.SPCfgFieldType.Date,
          format: SPTypes.DateFormat.DateTime
        } as Helper.IFieldInfoDate,
        {
          name: "rejectedOn",
          title: "Rejected On",
          type: Helper.SPCfgFieldType.Date,
          format: SPTypes.DateFormat.DateTime
        } as Helper.IFieldInfoDate,
        {
          name: "canceledOn",
          title: "Canceled On",
          type: Helper.SPCfgFieldType.Date,
          format: SPTypes.DateFormat.DateTime
        } as Helper.IFieldInfoDate,

        {
          name: "laborAmount",
          title: "Labor Amount",
          type: Helper.SPCfgFieldType.Currency,
          decimals: 2,
          defaultValue: "0"
        } as Helper.IFieldInfoCurrency,
        {
          name: "travelAmount",
          title: "Travel Amount",
          type: Helper.SPCfgFieldType.Currency,
          decimals: 2,
          defaultValue: "0"
        } as Helper.IFieldInfoCurrency,
        {
          name: "grandTotal",
          title: "Grand Total",
          type: Helper.SPCfgFieldType.Currency,
          decimals: 2,
          defaultValue: "0"
        } as Helper.IFieldInfoCurrency,

        {
          name: "currentWorkflowRun",
          title: "Current Workflow Run",
          type: Helper.SPCfgFieldType.Lookup,
          listName: Strings.Sites.main.lists.WorkflowRuns,
          showField: "ID"
        } as Helper.IFieldInfoLookup,
        {
          name: "effectiveApprovedRun",
          title: "Effective Approved Run",
          type: Helper.SPCfgFieldType.Lookup,
          listName: Strings.Sites.main.lists.WorkflowRuns,
          showField: "ID"
        } as Helper.IFieldInfoLookup,

        {
          name: "pdfUrl",
          title: "PDF Url",
          type: Helper.SPCfgFieldType.Text
        },
        {
          name: "pdfGeneratedOn",
          title: "PDF Generated On",
          type: Helper.SPCfgFieldType.Date,
          format: SPTypes.DateFormat.DateTime
        } as Helper.IFieldInfoDate
      ],
      ViewInformation: [
        {
          ViewName: "All Items",
          Default: true,
          ViewQuery: `
            <OrderBy>
              <FieldRef Name="authorization" Ascending="TRUE"/>
              <FieldRef Name="modNumber" Ascending="TRUE"/>
            </OrderBy>`,
          ViewFields: [
            "LinkTitle",
            "authorization",
            "modNumber",
            "modStatus",
            "grandTotal",
            "Created",
            "approvedOn"
          ]
        }
      ]
    },

    /* =========================
       IWA RESOURCES
       ========================= */
    {
      ListInformation: {
        Title: Strings.Sites.main.lists.Resources,
        Description: "*DO NOT DELETE* Employee roster row for base IWA authorizations and mods.",
        BaseTemplate: SPTypes.ListTemplateType.GenericList,
        OnQuickLaunch: false
      },
      TitleFieldDisplayName: "Resource Label",
      CustomFields: [
        {
          name: "authorization",
          title: "Authorization",
          type: Helper.SPCfgFieldType.Lookup,
          listName: Strings.Sites.main.lists.Authorizations,
          showField: "ID",
          required: true,
          indexed: true
        } as Helper.IFieldInfoLookup,
        {
          name: "mod",
          title: "Mod",
          type: Helper.SPCfgFieldType.Lookup,
          listName: Strings.Sites.main.lists.Mods,
          showField: "ID",
          indexed: true
        } as Helper.IFieldInfoLookup,

        {
          name: "lineScope",
          title: "Line Scope",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["base", "mod"],
          defaultValue: "base",
          multi: false,
          indexed: true
        } as Helper.IFieldInfoChoice,
        {
          name: "lineNumber",
          title: "Line Number",
          type: Helper.SPCfgFieldType.Number,
          decimals: 0
        } as Helper.IFieldInfoNumber,
        {
          name: "displayOrder",
          title: "Display Order",
          type: Helper.SPCfgFieldType.Number,
          decimals: 0
        } as Helper.IFieldInfoNumber,
        {
          name: "isActive",
          title: "Is Active?",
          type: Helper.SPCfgFieldType.Boolean,
          defaultValue: "1"
        } as Helper.IFieldInfoChoice,

        {
          name: "employee",
          title: "Employee",
          type: Helper.SPCfgFieldType.User,
          required: true
        } as Helper.IFieldInfoUser,

        {
          name: "state",
          title: "State",
          type: Helper.SPCfgFieldType.Text,
          required: true
        },
        {
          name: "laborCategory",
          title: "Labor Category",
          description: "Labor category assigned to the resource/employee",
          type: Helper.SPCfgFieldType.Text,
          required: true,
          indexed: true
        },
        {
          name: "comments",
          title: "Comments",
          type: Helper.SPCfgFieldType.Note,
          noteType: SPTypes.FieldNoteType.TextOnly
        } as Helper.IFieldInfoNote
      ],
      ViewInformation: [
        {
          ViewName: "All Items",
          Default: true,
          ViewQuery: `
            <OrderBy>
              <FieldRef Name="authorization" Ascending="TRUE"/>
              <FieldRef Name="mod" Ascending="TRUE"/>
              <FieldRef Name="displayOrder" Ascending="TRUE"/>
              <FieldRef Name="Title" Ascending="TRUE"/>
            </OrderBy>`,
          ViewFields: [
            "LinkTitle",
            "authorization",
            "mod",
            "lineScope",
            "employee",
            "state",
            "laborCategory",
            "isActive"
          ]
        }
      ]
    },

    /* =========================
   IWA LABOR LINE ITEMS
   ========================= */
    {
      ListInformation: {
        Title: Strings.Sites.main.lists.LaborLine,
        Description: "*DO NOT DELETE* Labor line items are the Billable charge row for base IWA authorizations and mods.",
        BaseTemplate: SPTypes.ListTemplateType.GenericList,
        OnQuickLaunch: false
      },
      TitleFieldDisplayName: "LaborLineItem Label",
      CustomFields: [
        {
          name: "authorization",
          title: "Authorization",
          type: Helper.SPCfgFieldType.Lookup,
          listName: Strings.Sites.main.lists.Authorizations,
          showField: "ID",
          required: true,
          indexed: true
        } as Helper.IFieldInfoLookup,
        {
          name: "mod",
          title: "Mod",
          type: Helper.SPCfgFieldType.Lookup,
          listName: Strings.Sites.main.lists.Mods,
          showField: "ID",
          indexed: true
        } as Helper.IFieldInfoLookup,

        {
          name: "lineScope",
          title: "Line Scope",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["base", "mod"],
          defaultValue: "base",
          multi: false,
          indexed: true
        } as Helper.IFieldInfoChoice,
        {
          name: "lineNumber",
          title: "Line Number",
          type: Helper.SPCfgFieldType.Number,
          decimals: 0
        } as Helper.IFieldInfoNumber,
        {
          name: "displayOrder",
          title: "Display Order",
          type: Helper.SPCfgFieldType.Number,
          decimals: 0
        } as Helper.IFieldInfoNumber,
        {
          name: "isActive",
          title: "Is Active?",
          type: Helper.SPCfgFieldType.Boolean,
          defaultValue: "1"
        } as Helper.IFieldInfoChoice,
        {
          name: "pricingType",
          title: "Pricing Type",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["tm", "ffp"],
          defaultValue: "tm",
          multi: false,
          indexed: true
        } as Helper.IFieldInfoChoice,
        {
          name: "jobId",
          title: "Job ID",
          description: "Direct Job ID / CLIN from JAMIS",
          type: Helper.SPCfgFieldType.Text,
          required: true,
          indexed: true
        },
        {
          name: "resources",
          title: "Resources",
          type: Helper.SPCfgFieldType.Lookup,
          listName: Strings.Sites.main.lists.Resources,
          showField: "ID",
          multi: true
        } as Helper.IFieldInfoLookup,
        {
          name: "annualSalary",
          title: "Annual Salary",
          type: Helper.SPCfgFieldType.Currency,
          decimals: 2,
          defaultValue: "0"
        } as Helper.IFieldInfoCurrency,
        {
          name: "standardRate",
          title: "Standard Rate",
          type: Helper.SPCfgFieldType.Currency,
          decimals: 4,
          defaultValue: "0"
        } as Helper.IFieldInfoCurrency,
        {
          name: "overtimeRate",
          title: "Overtime Rate",
          type: Helper.SPCfgFieldType.Currency,
          decimals: 4,
          defaultValue: "0"
        } as Helper.IFieldInfoCurrency,

        {
          name: "standardHours",
          title: "Standard Hours",
          type: Helper.SPCfgFieldType.Number,
          decimals: 2,
          defaultValue: "0"
        } as Helper.IFieldInfoNumber,
        {
          name: "overtimeHours",
          title: "Overtime Hours",
          type: Helper.SPCfgFieldType.Number,
          decimals: 2,
          defaultValue: "0"
        } as Helper.IFieldInfoNumber,

        {
          name: "standardAmount",
          title: "Standard Amount",
          type: Helper.SPCfgFieldType.Currency,
          decimals: 2,
          defaultValue: "0"
        } as Helper.IFieldInfoCurrency,
        {
          name: "overtimeAmount",
          title: "Overtime Amount",
          type: Helper.SPCfgFieldType.Currency,
          decimals: 2,
          defaultValue: "0"
        } as Helper.IFieldInfoCurrency,
        {
          name: "chargingPeriod",
          title: "Charging Period",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["monthly", "quarterly", "yearly"],
          defaultValue: "monthly"
        } as Helper.IFieldInfoChoice,
        {
          name: "periodQty",
          title: "Period Qty",
          type: Helper.SPCfgFieldType.Number,
          decimals: 0,
          defaultValue: "1"
        } as Helper.IFieldInfoNumber,
        {
          name: "lumpSumAmount",
          title: "Lump Sum Amount",
          type: Helper.SPCfgFieldType.Currency,
          decimals: 2,
          defaultValue: "0"
        } as Helper.IFieldInfoCurrency,
        {
          name: "totalAmount",
          title: "Total Amount",
          type: Helper.SPCfgFieldType.Currency,
          decimals: 2,
          defaultValue: "0"
        } as Helper.IFieldInfoCurrency,

        {
          name: "comments",
          title: "Comments",
          type: Helper.SPCfgFieldType.Note,
          noteType: SPTypes.FieldNoteType.TextOnly
        } as Helper.IFieldInfoNote
      ],
      ViewInformation: [
        {
          ViewName: "All Items",
          Default: true,
          ViewQuery: `
            <OrderBy>
              <FieldRef Name="authorization" Ascending="TRUE"/>
              <FieldRef Name="mod" Ascending="TRUE"/>
              <FieldRef Name="displayOrder" Ascending="TRUE"/>
              <FieldRef Name="Title" Ascending="TRUE"/>
            </OrderBy>`,
          ViewFields: [
            "LinkTitle",
            "authorization",
            "mod",
            "lineScope",
            "resources",
            "jobId",
            "standardHours",
            "overtimeHours",
            "totalAmount",
            "isActive"
          ]
        }
      ]
    },

    /* =========================
       IWA TRAVEL / ODC
       ========================= */
    {
      ListInformation: {
        Title: Strings.Sites.main.lists.TravelODC,
        Description: "*DO NOT DELETE* Travel and ODC line items for base IWA authorizations and mods.",
        BaseTemplate: SPTypes.ListTemplateType.GenericList,
        OnQuickLaunch: false
      },
      TitleFieldDisplayName: "Travel/ODC Label",
      CustomFields: [
        {
          name: "authorization",
          title: "Authorization",
          type: Helper.SPCfgFieldType.Lookup,
          listName: Strings.Sites.main.lists.Authorizations,
          showField: "ID",
          required: true,
          indexed: true
        } as Helper.IFieldInfoLookup,
        {
          name: "mod",
          title: "Mod",
          type: Helper.SPCfgFieldType.Lookup,
          listName: Strings.Sites.main.lists.Mods,
          showField: "ID",
          indexed: true
        } as Helper.IFieldInfoLookup,

        {
          name: "lineScope",
          title: "Line Scope",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["base", "mod"],
          defaultValue: "base",
          multi: false,
          indexed: true
        } as Helper.IFieldInfoChoice,
        {
          name: "lineNumber",
          title: "Line Number",
          type: Helper.SPCfgFieldType.Number,
          decimals: 0
        } as Helper.IFieldInfoNumber,
        {
          name: "displayOrder",
          title: "Display Order",
          type: Helper.SPCfgFieldType.Number,
          decimals: 0
        } as Helper.IFieldInfoNumber,
        {
          name: "isActive",
          title: "Is Active?",
          type: Helper.SPCfgFieldType.Boolean,
          defaultValue: "1"
        } as Helper.IFieldInfoChoice,

        {
          name: "lineType",
          title: "Line Type",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["travel", "odc", "other"],
          defaultValue: "travel",
          multi: false
        } as Helper.IFieldInfoChoice,
        {
          name: "jobId",
          title: "Job ID",
          description: "Direct Job ID / CLIN from JAMIS",
          type: Helper.SPCfgFieldType.Text,
          required: true,
          indexed: true
        },
        {
          name: "description",
          title: "Description",
          type: Helper.SPCfgFieldType.Note,
          noteType: SPTypes.FieldNoteType.TextOnly
        } as Helper.IFieldInfoNote,
        {
          name: "amount",
          title: "Amount",
          type: Helper.SPCfgFieldType.Currency,
          decimals: 2,
          defaultValue: "0"
        } as Helper.IFieldInfoCurrency,
        {
          name: "comments",
          title: "Comments",
          type: Helper.SPCfgFieldType.Note,
          noteType: SPTypes.FieldNoteType.TextOnly
        } as Helper.IFieldInfoNote
      ],
      ViewInformation: [
        {
          ViewName: "All Items",
          Default: true,
          ViewQuery: `
            <OrderBy>
              <FieldRef Name="authorization" Ascending="TRUE"/>
              <FieldRef Name="mod" Ascending="TRUE"/>
              <FieldRef Name="displayOrder" Ascending="TRUE"/>
              <FieldRef Name="Title" Ascending="TRUE"/>
            </OrderBy>`,
          ViewFields: [
            "LinkTitle",
            "authorization",
            "mod",
            "lineScope",
            "lineType",
            "jobId",
            "amount",
            "isActive"
          ]
        }
      ]
    },

    /* =========================
       IWA WORKFLOW RUNS
       ========================= */
    {
      ListInformation: {
        Title: Strings.Sites.main.lists.WorkflowRuns,
        Description: "*DO NOT DELETE* Workflow run instances for base IWA authorizations and mods.",
        BaseTemplate: SPTypes.ListTemplateType.GenericList,
        OnQuickLaunch: false
      },
      TitleFieldDisplayName: "Workflow Run Label",
      CustomFields: [
        {
          name: "authorization",
          title: "Authorization",
          type: Helper.SPCfgFieldType.Lookup,
          listName: Strings.Sites.main.lists.Authorizations,
          showField: "ID",
          required: true,
          indexed: true
        } as Helper.IFieldInfoLookup,
        {
          name: "mod",
          title: "Mod",
          type: Helper.SPCfgFieldType.Lookup,
          listName: Strings.Sites.main.lists.Mods,
          showField: "ID",
          indexed: true
        } as Helper.IFieldInfoLookup,

        {
          name: "runNumber",
          title: "Run Number",
          type: Helper.SPCfgFieldType.Number,
          decimals: 0,
          required: true,
          indexed: true
        } as Helper.IFieldInfoNumber,
        {
          name: "runType",
          title: "Run Type",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["base", "mod"],
          defaultValue: "base",
          multi: false
        } as Helper.IFieldInfoChoice,
        {
          name: "runStatus",
          title: "Run Status",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["active", "completed", "rejected", "canceled", "superseded"],
          defaultValue: "active",
          multi: false,
          indexed: true
        } as Helper.IFieldInfoChoice,
        {
          name: "hasDecision",
          title: "Has Decision?",
          type: Helper.SPCfgFieldType.Boolean,
          defaultValue: "0"
        } as Helper.IFieldInfoChoice,
        {
          name: "outcome",
          title: "Outcome",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["approved", "rejected", "canceled", "returned", "restarted", "none"],
          defaultValue: "none",
          multi: false
        } as Helper.IFieldInfoChoice,

        {
          name: "currentStepKey",
          title: "Current Step Key",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["submit", "pm", "hr", "ogPresident", "cfo", "submitter"],
          defaultValue: "submit",
          multi: false,
          indexed: true
        } as Helper.IFieldInfoChoice,
        {
          name: "pendingRole",
          title: "Pending Role",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["requestor", "pm", "hr", "ogPresident", "cfo", "admin", "system"],
          multi: false
        } as Helper.IFieldInfoChoice,
        {
          name: "pendingApprover",
          title: "Pending Approver",
          type: Helper.SPCfgFieldType.User
        } as Helper.IFieldInfoUser,

        {
          name: "stepAssignedDate",
          title: "Step Assigned Date",
          type: Helper.SPCfgFieldType.Date,
          format: SPTypes.DateFormat.DateTime
        } as Helper.IFieldInfoDate,
        {
          name: "completedOn",
          title: "Completed On",
          type: Helper.SPCfgFieldType.Date,
          format: SPTypes.DateFormat.DateTime
        } as Helper.IFieldInfoDate,
        {
          name: "skipPmStep",
          title: "Skip PM Step?",
          type: Helper.SPCfgFieldType.Boolean,
          defaultValue: "0"
        } as Helper.IFieldInfoChoice,
        {
          name: "restartReason",
          title: "Restart Reason",
          type: Helper.SPCfgFieldType.Text
        },
        {
          name: "restartComment",
          title: "Restart Comment",
          type: Helper.SPCfgFieldType.Note,
          noteType: SPTypes.FieldNoteType.TextOnly
        } as Helper.IFieldInfoNote,
        {
          name: "hr",
          title: "HR",
          type: Helper.SPCfgFieldType.User
        } as Helper.IFieldInfoUser,
        {
          name: "ogPresident",
          title: "OG President",
          type: Helper.SPCfgFieldType.User
        } as Helper.IFieldInfoUser,
        {
          name: "cfo",
          title: "CFO",
          type: Helper.SPCfgFieldType.User
        } as Helper.IFieldInfoUser,
        {
          name: "approvedSnapshotJson",
          title: "Approved Snapshot Json",
          type: Helper.SPCfgFieldType.Note,
          noteType: SPTypes.FieldNoteType.TextOnly
        } as Helper.IFieldInfoNote
      ],
      ViewInformation: [
        {
          ViewName: "All Items",
          Default: true,
          ViewQuery: `
            <OrderBy>
              <FieldRef Name="authorization" Ascending="TRUE"/>
              <FieldRef Name="runNumber" Ascending="FALSE"/>
            </OrderBy>`,
          ViewFields: [
            "LinkTitle",
            "authorization",
            "mod",
            "runNumber",
            "runType",
            "runStatus",
            "currentStepKey",
            "pendingApprover",
            "Created",
            "completedOn"
          ]
        }
      ]
    },

    /* =========================
       IWA WORKFLOW ACTIONS
       ========================= */
    {
      ListInformation: {
        Title: Strings.Sites.main.lists.WorkflowActions,
        Description: "*DO NOT DELETE* Workflow history/action rows for IWA authorizations and mods.",
        BaseTemplate: SPTypes.ListTemplateType.GenericList,
        OnQuickLaunch: false
      },
      TitleFieldDisplayName: "Workflow Action Label",
      CustomFields: [
        {
          name: "authorization",
          title: "Authorization",
          type: Helper.SPCfgFieldType.Lookup,
          listName: Strings.Sites.main.lists.Authorizations,
          showField: "ID",
          required: true,
          indexed: true
        } as Helper.IFieldInfoLookup,
        {
          name: "mod",
          title: "Mod",
          type: Helper.SPCfgFieldType.Lookup,
          listName: Strings.Sites.main.lists.Mods,
          showField: "ID",
          indexed: true
        } as Helper.IFieldInfoLookup,
        {
          name: "workflowRun",
          title: "Workflow Run",
          type: Helper.SPCfgFieldType.Lookup,
          listName: Strings.Sites.main.lists.WorkflowRuns,
          showField: "ID",
          required: true,
          indexed: true
        } as Helper.IFieldInfoLookup,

        {
          name: "stepKey",
          title: "Step Key",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["submit", "pm", "hr", "ogPresident", "cfo", "submitter"],
          required: true,
          multi: false,
          indexed: true
        } as Helper.IFieldInfoChoice,
        {
          name: "actionType",
          title: "Action Type",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["submitted", "modified", "approved", "rejected", "returned", "restarted", "canceled", "skipped", "systemGenerated", "pdfGenerated"],
          required: true,
          multi: false,
          indexed: true
        } as Helper.IFieldInfoChoice,

        {
          name: "actionBy",
          title: "Action By",
          type: Helper.SPCfgFieldType.User
        } as Helper.IFieldInfoUser,
        {
          name: "actionDate",
          title: "Action Date",
          type: Helper.SPCfgFieldType.Date,
          format: SPTypes.DateFormat.DateTime,
          required: true,
          indexed: true
        } as Helper.IFieldInfoDate,

        {
          name: "role",
          title: "Role",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["requestor", "pm", "hr", "ogPresident", "cfo", "admin", "system"],
          multi: false
        } as Helper.IFieldInfoChoice,
        {
          name: "comments",
          title: "Comments",
          type: Helper.SPCfgFieldType.Note,
          noteType: SPTypes.FieldNoteType.TextOnly
        } as Helper.IFieldInfoNote,

        {
          name: "fromStepKey",
          title: "From Step Key",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["submit", "pm", "hr", "ogPresident", "cfo", "submitter"],
          multi: false
        } as Helper.IFieldInfoChoice,
        {
          name: "toStepKey",
          title: "To Step Key",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["submit", "pm", "hr", "ogPresident", "cfo", "submitter"],
          multi: false
        } as Helper.IFieldInfoChoice,

        {
          name: "wasSkipped",
          title: "Was Skipped?",
          type: Helper.SPCfgFieldType.Boolean,
          defaultValue: "0"
        } as Helper.IFieldInfoChoice,
        {
          name: "skipReason",
          title: "Skip Reason",
          type: Helper.SPCfgFieldType.Text
        },
        {
          name: "changeSummary",
          title: "Change Summary",
          type: Helper.SPCfgFieldType.Note,
          noteType: SPTypes.FieldNoteType.TextOnly
        } as Helper.IFieldInfoNote,
        {
          name: "changePayloadJson",
          title: "Change Payload Json",
          type: Helper.SPCfgFieldType.Note,
          noteType: SPTypes.FieldNoteType.TextOnly
        }
      ],
      ViewInformation: [
        {
          ViewName: "All Items",
          Default: true,
          ViewQuery: `
            <OrderBy>
              <FieldRef Name="actionDate" Ascending="FALSE"/>
            </OrderBy>`,
          ViewFields: [
            "LinkTitle",
            "authorization",
            "mod",
            "workflowRun",
            "stepKey",
            "actionType",
            "actionBy",
            "actionDate",
            "role"
          ]
        }
      ]
    },

    /* =========================
       IWA APP USERS
       ========================= */
    {
      ListInformation: {
        Title: Strings.Sites.main.lists.Users,
        Description: "*DO NOT DELETE* Tracks users who access the IWA app, their role, mode preference, and backup users.",
        BaseTemplate: SPTypes.ListTemplateType.GenericList,
        OnQuickLaunch: false
      },
      TitleFieldDisplayName: "User Label",
      TitleFieldRequired: false,
      TitleFieldDefaultValue: "IWA App User",
      CustomFields: [
        {
          name: "user",
          title: "User",
          type: Helper.SPCfgFieldType.User,
          required: true,
          indexed: true
        } as Helper.IFieldInfoUser,
        {
          name: "modePreference",
          title: "Mode Preference",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["dark", "light"],
          defaultValue: "light",
          multi: false
        } as Helper.IFieldInfoChoice,
        {
          name: "role",
          title: "Role",
          type: Helper.SPCfgFieldType.Choice,
          choices: ["user", "admin"],
          defaultValue: "user",
          multi: false,
          indexed: true
        } as Helper.IFieldInfoChoice,
        {
          name: "lastVisit",
          title: "Last Visit",
          type: Helper.SPCfgFieldType.Date,
          format: SPTypes.DateFormat.DateTime
        } as Helper.IFieldInfoDate,
        {
          name: "visitCount",
          title: "Visit Count",
          type: Helper.SPCfgFieldType.Number,
          decimals: 0,
          defaultValue: "0"
        } as Helper.IFieldInfoNumber,
        {
          name: "backups",
          title: "Backups",
          type: Helper.SPCfgFieldType.User,
          multi: true
        } as Helper.IFieldInfoUser,
        {
          name: "hasBackup",
          title: "Has Backup",
          description: "Indicates whether or not this user has a backup assigned",
          type: Helper.SPCfgFieldType.Boolean,
          defaultValue: "0"
        }
      ],
      ViewInformation: [
        {
          ViewName: "All Items",
          Default: true,
          ViewQuery: `
            <OrderBy>
              <FieldRef Name="role" Ascending="TRUE"/>
              <FieldRef Name="Title" Ascending="TRUE"/>
            </OrderBy>`,
          ViewFields: [
            "LinkTitle",
            "user",
            "role",
            "modePreference",
            "lastVisit",
            "visitCount",
            "backups"
          ]
        }
      ]
    },

    /* =========================
       IWA COUNTERS
       ========================= */
    {
      ListInformation: {
        Title: Strings.Sites.main.lists.Counters,
        Description: "*DO NOT DELETE* Stores yearly sequence counters for smart IWA numbering.",
        BaseTemplate: SPTypes.ListTemplateType.GenericList,
        OnQuickLaunch: false
      },
      TitleFieldDisplayName: "Year",
      CustomFields: [
        {
          name: "currentId",
          title: "Current ID",
        description: "Last authorization item ID that consumed a number.",
          type: Helper.SPCfgFieldType.Number,
          decimals: 0,
          defaultValue: "0"
        } as Helper.IFieldInfoNumber,
        {
          name: "currentSeq",
          title: "Current Seq",
          description: "Last allocated sequence.",
          type: Helper.SPCfgFieldType.Number,
          decimals: 0,
          defaultValue: "0"
        } as Helper.IFieldInfoNumber,
        {
          name: "nextSeq",
          title: "Next Seq",
          description: "Next available sequence (authoritative).",
          type: Helper.SPCfgFieldType.Number,
          decimals: 0,
          defaultValue: "1"
        } as Helper.IFieldInfoNumber
      ],
      ViewInformation: [
        {
          ViewName: "All Items",
          Default: true,
          ViewQuery: `
            <OrderBy>
              <FieldRef Name="Title" Ascending="FALSE"/>
            </OrderBy>`,
          ViewFields: [
            "LinkTitle",
            "currentId",
            "currentSeq",
            "nextSeq",
            "Modified"
          ]
        }
      ]
    }
  ]
});
