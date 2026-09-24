import { ContextInfo, Web } from "gd-sprest";
import { WebPartContext } from "@microsoft/sp-webpart-base";
import Strings, { setContext } from "../common/strings";
import {
    IAuthorizationItem,
    IAppUserItem,
    IConfigItem,
    IContractItem,
    IEntityItem,
    IInvoiceItem,
    IJobItem,
    ILobItem,
    IModItem,
    IOgItem,
    IPeoplePicker,
    IWorkflowRunItem
} from "./props";
import { formatError } from "../common/utils";
import { AppUserService } from "../users/userService";
import { indirectContract, indirectInvoice } from "./indirectCharges";

export class DataSource {
    static initialized: boolean = false;

    public static init(override: boolean, context?: WebPartContext): PromiseLike<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            if (context) {
                setContext(context);
            }

            if (!this.initialized || override) {
                Promise.all([
                    this.getAuthorizations(),
                    this.getConfig(),
                    this.getEntities(),
                    this.getLOBs(),
                    this.getOGs(),
                    this.getContracts(),
                    //this.getAllJobs()
                ])
                    .then(() => {
                        this.initialized = true;
                        resolve(true);
                    })
                    .catch((error) => {
                        console.error("Error initializing data", formatError(error));
                        reject(error);
                    });
            } else {
                resolve(true);
            }
        });
    }

    static isAdmin: boolean = false;
    static isOGP: boolean = false;

    private static _currentUser: IAppUserItem | undefined;
    static get CurrentUser(): IAppUserItem | undefined { return this._currentUser; }
    static get CurrentUserId(): number | undefined { return this._currentUser?.user?.Id ?? ContextInfo.userId; }

    private static isCurrentUserOgPresident(user: IAppUserItem): boolean {
        const currentEmail = user.user?.EMail?.trim().toLowerCase();
        const currentId = user.user?.Id;

        return this._ogs.some((og: IOgItem): boolean => {
            const presidentEmail = og.president?.EMail?.trim().toLowerCase();
            const presidentId = og.president?.Id;

            return (!!currentEmail && !!presidentEmail && currentEmail === presidentEmail) ||
                (!!currentId && !!presidentId && currentId === presidentId);
        });
    }

    static setCurrentUser(user: IAppUserItem): boolean {
        this._currentUser = user;
        this.isAdmin = (user.role ?? "user").toLowerCase() === "admin";
        this.isOGP = this.isCurrentUserOgPresident(user);
        return true;
    }

    static async getOrCreateCurrentUser(): Promise<IAppUserItem> {
        const userId = ContextInfo.userId;

        if (!userId) {
            throw new Error("Current user is not available.");
        }

        const existing = await new Promise<IAppUserItem | undefined>((resolve, reject) => {
            Web().Lists(Strings.Sites.main.lists.Users).Items().query({
                Select: [
                    "Id", "Title", "role",
                    "modePreference", "lastVisit", "visitCount", "hasBackup",
                    "user/Id", "user/Title", "user/EMail",
                    "backups/Id", "backups/Title", "backups/EMail"
                ],
                Expand: ["user", "backups"],
                Filter: `user/Id eq ${userId}`,
                Top: 1
            }).execute(
                (items) => resolve((items?.results?.[0] as unknown as IAppUserItem) ?? undefined),
                (error) => reject(new Error(`Error fetching current user: ${formatError(error)}`))
            );
        });

        if (existing?.Id) {
            await AppUserService.touchCurrentUser(existing.Id, existing.visitCount ?? 0);

            existing.lastVisit = new Date().toISOString();

            if (sessionStorage.getItem(AppUserService.visitSessionKey) === "1") {
                existing.visitCount = (existing.visitCount ?? 0) + 1;
            }

            this.setCurrentUser(existing);
            return existing;
        }

        const created = await AppUserService.createNewUserOnFirstVisit();
        this.setCurrentUser(created);
        return created;
    }

    /* =========================
       APP USERS
       ========================= */

    private static _users: IAppUserItem[] = [];
    static get AppUsers(): IAppUserItem[] { return this._users; }

    static getAppUsers(): Promise<IAppUserItem[]> {
        return new Promise<IAppUserItem[]>((resolve, reject) => {
            this._users = [];

            Web().Lists(Strings.Sites.main.lists.Users).Items().query({
                GetAllItems: true,
                OrderBy: ["user"],
                Select: [
                    "Id", "Title", "role",
                    "modePreference", "lastVisit", "visitCount", "hasBackup",
                    "user/Id", "user/Title", "user/EMail",
                    "backups/Id", "backups/Title", "backups/EMail"
                ],
                Expand: ["user", "backups"]
            }).execute(
                (items) => {
                    this._users = (items?.results ?? []) as unknown as IAppUserItem[];
                    resolve(this._users);
                },
                (error) => reject(new Error(`Error fetching App Users: ${formatError(error)}`))
            );
        });
    }

    //update app user role real time (needs to be here for local user cached list refresh)
    static async updateAppUserRole(appUserItemId: number, role: IAppUserItem["role"]): Promise<void> {

        // Best-effort "last admin" protection using cached list
        const target = this._users.find(u => u.Id === appUserItemId);
        const currentRole = (target?.role ?? "user").toLowerCase() as IAppUserItem["role"];
        const nextRole = (role ?? "user").toLowerCase() as IAppUserItem["role"];

        if (currentRole === "admin" && nextRole !== "admin") {
            const adminCount = this._users.filter(u => ((u.role ?? "user").toLowerCase() === "admin")).length;
            if (adminCount <= 1) {
                throw new Error("You can't demote the last Admin.");
            }
        }

        await AppUserService.updateRole(appUserItemId, nextRole);

        // Update local cache
        const idx = this._users.findIndex(u => u.Id === appUserItemId);
        if (idx >= 0) {
            this._users = [
                ...this._users.slice(0, idx),
                { ...this._users[idx], role: nextRole },
                ...this._users.slice(idx + 1)
            ];
        }

        // If you changed yourself, refresh flags
        if (this._currentUser?.Id === appUserItemId) {
            this.setCurrentUser({ ...this._currentUser, role: nextRole });
        }
    }

    /* =========================
       CONFIG
       ========================= */

    private static _config: IConfigItem[] = [];
    static get Config(): IConfigItem[] { return this._config; }

    static get HR(): IPeoplePicker | undefined {
        return this._config.find((config) => config.IsFor === "HR")?.User;
    }

    static get CFO(): IPeoplePicker | undefined {
        return this._config.find((config) => config.IsFor === "CFO")?.User;
    }

    static get UserGuide(): string | undefined {
        const guide = this._config.find((config: IConfigItem) => config.IsFor === "UserGuide" && config.Acronym === "IWA")?.Title;
        return guide?.trim() || undefined;
    }

    static get States(): string[] {
        return this._config
            .filter((config) => config.IsFor === "State")
            .map((config) => config.Title?.trim() ?? "")
            .filter((title) => !!title)
            .sort((left, right) => left.localeCompare(right));
    }

    static get LaborCategories(): string[] {
        return this._config
            .filter((config) => config.IsFor === "LaborCategory")
            .map((config) => config.Title?.trim() ?? "")
            .filter((title) => !!title)
            .sort((left, right) => left.localeCompare(right));
    }

    static getConfig(): Promise<IConfigItem[]> {
        return new Promise<IConfigItem[]>((resolve, reject) => {
            this._config = [];

            Web(Strings.Sites.lookups.url)
                .Lists(Strings.Sites.lookups.lists.Config)
                .Items()
                .query({
                    GetAllItems: true,
                    Select: [
                        "Id", "Title", "IsFor", "Acronym",
                        "User/Id", "User/Title", "User/EMail"
                    ],
                    Expand: ["User"],
                    Filter: `IsFor eq 'HR' or IsFor eq 'CFO' or IsFor eq 'UserGuide' or IsFor eq 'State' or IsFor eq 'LaborCategory'`,
                })
                .execute(
                    (items) => {
                        this._config = (items?.results ?? []) as unknown as IConfigItem[];
                        resolve(this._config);
                    },
                    (error) => reject(new Error(`Error fetching Config: ${formatError(error)}`))
                );
        });
    }

    /* =========================
       AUTHORIZATIONS
       ========================= */

    public static authorizationSelectQuery: string[] = [
        "Id", "Title", "authorizationStatus",
        "donorEntity", "donorEntityAbbr", "receivingEntity",
        "receivingEntityAbbr", "og", "lob",
        "contractName", "contractId", "iwaJamisProjectId", "customerContractCode", "naicsCode", "invoice", "contractType",
        "periodStart", "periodEnd", "scopeOfWork",
        "justification", "notes", "baseLaborAmount",
        "baseTravelAmount", "baseGrandTotal", "approvedLaborAmount",
        "approvedTravelAmount", "approvedGrandTotal", "modCount",
        "pdfUrl", "pdfGeneratedOn", "approvedOn",
        "rejectedOn", "canceledOn", "closedOn",
        "Created", "Modified", "Author/Id",
        "Author/Title", "Author/EMail", "Editor/Id",
        "Editor/Title", "Editor/EMail", "backupRequestor/Id",
        "backupRequestor/Title", "backupRequestor/EMail", "donorGm/Id",
        "donorGm/Title", "donorGm/EMail", "receivingGm/Id",
        "receivingGm/Title", "receivingGm/EMail", "pm/Id", "pm/Title", "pm/EMail", "currentWorkflowRun/Id",
        "currentWorkflowRun/Title", "effectiveApprovedRun/Id", "effectiveApprovedRun/Title"
    ];

    public static authorizationExpandQuery: string[] = ["Author", "Editor", "backupRequestor", "donorGm", "receivingGm", "pm", "currentWorkflowRun", "effectiveApprovedRun"];

    private static _authorizations: IAuthorizationItem[] = [];
    static get Authorizations(): IAuthorizationItem[] { return this._authorizations; }

    static getAuthorizations(): Promise<IAuthorizationItem[]> {
        return new Promise<IAuthorizationItem[]>((resolve, reject) => {
            this._authorizations = [];

            Web(Strings.Sites.main.url)
                .Lists(Strings.Sites.main.lists.Authorizations)
                .Items()
                .query({
                    GetAllItems: true,
                    OrderBy: ["Created"],
                    Select: this.authorizationSelectQuery,
                    Expand: this.authorizationExpandQuery,
                    Filter: "authorizationStatus ne 'draft'",
                    Top: 5000
                })
                .execute(
                    (items) => {
                        this._authorizations = (items?.results ?? []) as unknown as IAuthorizationItem[];
                        resolve(this._authorizations);
                    },
                    (error) => reject(new Error(`Error fetching Authorizations: ${formatError(error)}`))
                );
        });
    }

    static getDraftAuthorizationsByAuthor(): Promise<IAuthorizationItem[]> {
        return new Promise<IAuthorizationItem[]>((resolve, reject) => {
            const currentUserId = ContextInfo.userId;

            if (!currentUserId) {
                resolve([]);
                return;
            }

            Web(Strings.Sites.main.url)
                .Lists(Strings.Sites.main.lists.Authorizations)
                .Items()
                .query({
                    GetAllItems: true,
                    OrderBy: ["Modified desc"],
                    Select: this.authorizationSelectQuery,
                    Expand: this.authorizationExpandQuery,
                    Filter: `authorizationStatus eq 'draft' and Author/Id eq ${currentUserId}`,
                    Top: 5000
                })
                .execute(
                    (items) => resolve((items?.results ?? []) as unknown as IAuthorizationItem[]),
                    (error) => reject(new Error(`Error fetching Draft Authorizations: ${formatError(error)}`))
                );
        });
    }

    static getDraftModsByAuthor(): Promise<IModItem[]> {
        return new Promise<IModItem[]>((resolve, reject) => {
            const currentUserId = ContextInfo.userId;

            if (!currentUserId) {
                resolve([]);
                return;
            }

            Web(Strings.Sites.main.url)
                .Lists(Strings.Sites.main.lists.Mods)
                .Items()
                .query({
                    GetAllItems: true,
                    OrderBy: ["Modified desc"],
                    Select: [
                        "Id", "Title", "modNumber", "modStatus",
                        "reason", "changeSummary", "notes",
                        "laborAmount", "travelAmount", "grandTotal",
                        "Created", "Modified", "Author/Id",
                        "Author/Title", "Author/EMail",
                        "authorization/Id", "authorization/Title"
                    ],
                    Expand: ["Author", "authorization"],
                    Filter: `modStatus eq 'draft' and Author/Id eq ${currentUserId}`,
                    Top: 5000
                })
                .execute(
                    (items) => resolve((items?.results ?? []) as unknown as IModItem[]),
                    (error) => reject(new Error(`Error fetching Draft Mods: ${formatError(error)}`))
                );
        });
    }

    /* =========================
       WORKFLOW RUNS
       ========================= */

    public static runSelectQuery: string[] = [
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

    public static runExpandQuery: string[] = ["authorization", "mod", "pendingApprover", "hr", "ogPresident", "cfo"];

    static getCurrentWorkflowRuns(): Promise<IWorkflowRunItem[]> {
        return new Promise<IWorkflowRunItem[]>((resolve, reject) => {
            Web().Lists(Strings.Sites.main.lists.WorkflowRuns).Items().query({
                GetAllItems: true,
                Select: this.runSelectQuery,
                Expand: this.runExpandQuery,
                Filter: `runStatus ne 'superseded'`,
                OrderBy: ["authorization/Id asc", "runNumber desc"],
                Top: 5000
            }).execute(
                (items) => resolve((items?.results ?? []) as unknown as IWorkflowRunItem[]),
                (error) => reject(new Error(`Error fetching current Workflow Runs: ${formatError(error)}`))
            );
        });
    }

    /* =========================
       LOOKUPS
       ========================= */

    private static _entities: IEntityItem[] = [];
    static get Entities(): IEntityItem[] { return this._entities; }

    static getEntities(): Promise<IEntityItem[]> {
        return new Promise<IEntityItem[]>((resolve, reject) => {
            this._entities = [];

            Web(Strings.Sites.lookups.url)
                .Lists(Strings.Sites.lookups.lists.Entities)
                .Items()
                .query({
                    GetAllItems: true,
                    OrderBy: ["Title"],
                    Select: [
                        "Id", "Title", "abbr", "GM/Id", "GM/Title", "GM/EMail", "combinedTitle"
                    ],
                    Expand: ["GM"]
                })
                .execute(
                    (items) => {
                        this._entities = (items?.results ?? []) as unknown as IEntityItem[];
                        resolve(this._entities);
                    },
                    (error) => reject(new Error(`Error fetching Entities: ${formatError(error)}`))
                );
        });
    }

    private static _lobs: ILobItem[] = [];
    static get LOBs(): ILobItem[] { return this._lobs; }

    static getLOBs(): Promise<ILobItem[]> {
        return new Promise<ILobItem[]>((resolve, reject) => {
            this._lobs = [];

            Web(Strings.Sites.lookups.url)
                .Lists(Strings.Sites.lookups.lists.LOBs)
                .Items()
                .query({
                    GetAllItems: true,
                    OrderBy: ["Title"],
                    Select: ["Id", "Title", "coo/Id", "coo/Title", "coo/EMail"],
                    Expand: ["coo"]
                })
                .execute(
                    (items) => {
                        this._lobs = (items?.results ?? []) as unknown as ILobItem[];
                        resolve(this._lobs);
                    },
                    (error) => reject(new Error(`Error fetching LOBs: ${formatError(error)}`))
                );
        });
    }

    private static _ogs: IOgItem[] = [];
    static get OGs(): IOgItem[] { return this._ogs; }

    static getOGs(): Promise<IOgItem[]> {
        return new Promise<IOgItem[]>((resolve, reject) => {
            this._ogs = [];

            Web(Strings.Sites.lookups.url)
                .Lists(Strings.Sites.lookups.lists.OGs)
                .Items()
                .query({
                    GetAllItems: true,
                    OrderBy: ["Title"],
                    Select: [
                        "Id", "Title", "lob/Id",
                        "lob/Title", "president/Id", "president/Title",
                        "president/EMail", "CM/Id", "CM/Title",
                        "CM/EMail", "SCM/Id", "SCM/Title",
                        "SCM/EMail", "ogType", "parentOg/Id",
                        "parentOg/Title", "isActive", "isSelectable"
                    ],
                    Expand: ["lob", "president", "CM", "SCM", "parentOg"]
                })
                .execute(
                    (items) => {
                        this._ogs = (items?.results ?? []) as unknown as IOgItem[];
                        if (this._currentUser) {
                            this.isOGP = this.isCurrentUserOgPresident(this._currentUser);
                        }
                        resolve(this._ogs);
                    },
                    (error) => reject(new Error(`Error fetching OGs: ${formatError(error)}`))
                );
        });
    }

    /* =========================
       JAMIS
       ========================= */

    private static _contracts: IContractItem[] = [];
    static get Contracts(): IContractItem[] { return this._contracts; }

    // manually append a fake contract for INDIRECTS
    private static appendManualContracts(contracts: IContractItem[]): IContractItem[] {
        const contractsById = new Map<string, IContractItem>();

        [...contracts, indirectContract].forEach((contract: IContractItem): void => {
            contractsById.set(contract.field_19, contract);
        });

        return Array.from(contractsById.values());
    }

    // manually append a fake invoice for INDIRECTS
    private static appendManualInvoices(invoices: IInvoiceItem[], contractId: string): IInvoiceItem[] {
        const invoicesById = new Map<string, IInvoiceItem>();

        invoices.forEach((invoice: IInvoiceItem): void => {
            invoicesById.set(invoice.InvoiceID1, invoice);
        });

        if (indirectInvoice.field_49 === contractId) {
            invoicesById.set(indirectInvoice.InvoiceID1, indirectInvoice);
        }

        return Array.from(invoicesById.values());
    }

    static getContracts(): Promise<IContractItem[]> {
        return new Promise<IContractItem[]>((resolve, reject) => {
            this._contracts = [];

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            Web(Strings.Sites.jamis.url)
                .Lists(Strings.Sites.jamis.lists.ContractEP)
                .Items()
                .query({
                    GetAllItems: true,
                    OrderBy: ["field_20"],
                    Select: [
                        "Id", "Title", "field_19", "field_20", "field_35", "field_21",
                        "field_23", "field_73", "field_75", "field_16"
                    ],
                    Top: 5000
                })
                .execute(
                    (items) => {
                        const allContracts = (items?.results ?? []) as unknown as IContractItem[];
                        // no longer used - was filtering contracts where completion date is in the future
                        //this._contracts = allContracts.filter((contract) => new Date(contract.field_16) >= today);
                        this._contracts = this.appendManualContracts(
                            allContracts.filter((contract) => !contract.field_20?.includes("New Business"))
                        );
                        resolve(this._contracts);
                    },
                    (error) => reject(new Error(`Error fetching Contracts: ${formatError(error)}`))
                );
        });
    }

    private static _invoices: IInvoiceItem[] = [];
    static get Invoices(): IInvoiceItem[] { return this._invoices; }

    // Exclude historical/internal task orders starting with "HIS" from invoice dropdowns.
    // ^ = start of string
    // HIS = literal text
    // \d* = zero or more digits
    // $ = end of string
    // i = case-insensitive
    private static isUsableInvoice(invoice: IInvoiceItem): boolean {
        return !/^HIS\d*$/i.test((invoice.field_14 ?? "").trim());
    }

    static getInvoicesByContract(contractId: string): Promise<IInvoiceItem[]> {
        return new Promise<IInvoiceItem[]>((resolve, reject) => {
            this._invoices = [];

            Web(Strings.Sites.jamis.url)
                .Lists(Strings.Sites.jamis.lists.InvoiceEP)
                .Items()
                .query({
                    GetAllItems: true,
                    OrderBy: ["field_14"],
                    Select: [
                        "Id", "Title", "field_49", "field_28", "field_14", "InvoiceID1", "field_42"
                    ],
                    Filter: `field_49 eq '${contractId}'`,
                    Top: 5000
                })
                .execute(
                    (items) => {
                        this._invoices = this.appendManualInvoices(
                            ((items?.results ?? []) as unknown as IInvoiceItem[])
                                .filter((invoice: IInvoiceItem): boolean => this.isUsableInvoice(invoice)),
                            contractId
                        );
                        resolve(this._invoices);
                    },
                    (error) => reject(new Error(`Error fetching Invoices: ${formatError(error)}`))
                );
        });
    }

    private static _jobs: IJobItem[] = [];
    static get Jobs(): IJobItem[] { return this._jobs; }

    private static isChargeableJob(job: IJobItem, invoiceId1: string): boolean {
        const jobId = job.field_13 ?? "";
        const jobTitle = (job.field_19 ?? "").toLowerCase();
        const isIndirectInvoice = invoiceId1 === indirectInvoice.InvoiceID1;

        return (isIndirectInvoice || !jobId.startsWith(`${invoiceId1}-0000`)) && // filters out jobs whose third segment is 0000. Allows Indirect jobs.
            !jobTitle.includes("subaccrual") &&
            // Exclude admin bucket jobs whose title begins with ADM.
            // ^ = start of string
            // adm = literal text
            // \b = word boundary, so ADM must end there as a word
            // i = case-insensitive
            !/^adm\b/i.test(job.field_19 ?? "");
    }

    static getJobsByInvoice(invoiceId1: string): Promise<IJobItem[]> {
        return new Promise<IJobItem[]>((resolve, reject) => {
            this._jobs = [];
            const trimmedInvoiceId = invoiceId1.trim();

            if (!trimmedInvoiceId) {
                resolve([]);
                return;
            }

            const jobIdPrefix = trimmedInvoiceId.endsWith("-") ? trimmedInvoiceId : `${trimmedInvoiceId}-`;
            const escapedJobIdPrefix = jobIdPrefix.replace(/'/g, "''");

            // Query jobs only for the selected task order/invoice. GetAllItems tells
            // gd-sprest to follow SharePoint paging links, which is important because
            // JobEndPoint can exceed the 5,000-item page/list-view threshold.
            // GetAllItems helps page through accepted queries, but the filtered column still needs to be threshold-safe.
            Web(Strings.Sites.jamis.url)
                .Lists(Strings.Sites.jamis.lists.JobEP)
                .Items()
                .query({
                    GetAllItems: true,
                    Select: ["Id", "field_13", "field_19", "field_74"],
                    Filter: `startswith(field_13, '${escapedJobIdPrefix}')`,
                    Top: 5000
                })
                .execute(
                    (items) => {
                        this._jobs = ((items?.results ?? []) as unknown as IJobItem[])
                            // Jobs with a third segment of 0000 are admin/subaccrual style
                            // buckets and should not be selected for IWA charging.
                            .filter((job: IJobItem): boolean => this.isChargeableJob(job, trimmedInvoiceId))
                            .sort((left: IJobItem, right: IJobItem): number => {
                                const idSort = (left.field_13 ?? "").localeCompare(right.field_13 ?? "", undefined, { numeric: true, sensitivity: "base" });

                                if (idSort !== 0) {
                                    return idSort;
                                }

                                return (left.field_19 ?? "").localeCompare(right.field_19 ?? "", undefined, { numeric: true, sensitivity: "base" });
                            });
                        resolve(this._jobs);
                    },
                    (error) => {
                        reject(new Error(`Error fetching Jobs by Invoice: ${formatError(error)}`));
                    }
                );
        });
    }

    //testing 
    // private static _allJobs:IJobItem[] = [];
    // static getAllJobs(): Promise<IJobItem[]> {
    //     if (this._allJobs.length > 0) {
    //         return Promise.resolve(this._allJobs);
    //     }

    //     return new Promise((resolve, reject) => {
    //         Web(Strings.Sites.jamis.url)
    //             .Lists(Strings.Sites.jamis.lists.JobEP)
    //             .Items()
    //             .query({
    //                 GetAllItems: true,
    //                 Select: ["Id", "field_13", "field_19", "field_74"]                    
    //             })
    //             .execute(
    //                 (items) => {
    //                     this._allJobs = (items?.results ?? []) as unknown as IJobItem[];
    //                     console.log("ALL JOBS", this._allJobs);
    //                     resolve(this._allJobs);
    //                 },
    //                 (error) => {
    //                     console.error("ERROR FETCHING ALL JOBS", error);
    //                     reject(error)
    //                 }
    //             );
    //     });
    // }

    static getJobsByContract(contractId: string, jobPrefixes?: string[]): Promise<IJobItem[]> {
        return new Promise<IJobItem[]>((resolve, reject) => {
            Promise.resolve(jobPrefixes?.length
                ? jobPrefixes.map((prefix: string): IInvoiceItem => ({ Id: 0, Title: prefix, field_49: contractId, field_28: "", field_14: "", InvoiceID1: prefix, field_42: "" }))
                : this.getInvoicesByContract(contractId))
                .then(async (invoices: IInvoiceItem[]): Promise<void> => {
                    const jobs = await Promise.all(invoices.map((invoice: IInvoiceItem): Promise<IJobItem[]> => this.getJobsByInvoice(invoice.InvoiceID1)));
                    const jobsById = new Map<number, IJobItem>();

                    jobs.flat().forEach((job: IJobItem): void => {
                        jobsById.set(job.Id, job);
                    });

                    this._jobs = Array.from(jobsById.values()).sort((left: IJobItem, right: IJobItem): number => {
                        const idSort = (left.field_13 ?? "").localeCompare(right.field_13 ?? "", undefined, { numeric: true, sensitivity: "base" });

                        if (idSort !== 0) {
                            return idSort;
                        }

                        return (left.field_19 ?? "").localeCompare(right.field_19 ?? "", undefined, { numeric: true, sensitivity: "base" });
                    });
                    resolve(this._jobs);
                })
                .catch((error: unknown): void => reject(error));
        });
    }
}
