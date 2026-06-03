import { ContextInfo, Web } from "gd-sprest";
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { SPHttpClient, ISPHttpClientOptions } from "@microsoft/sp-http";
import Strings from "../common/strings";
import { encodeListName } from "../common/utils";

type MigrationRow = Record<string, string | number | boolean | undefined>;

export interface IMigrationPlan {
  authorizations: MigrationRow[];
  mods: MigrationRow[];
  resources: MigrationRow[];
  laborLines: MigrationRow[];
  travelOdc: MigrationRow[];
  workflowRuns: MigrationRow[];
  workflowActions: MigrationRow[];
  issues?: MigrationRow[];
}

export interface IMigrationTrialResult {
  authorizationId: number;
  created: Record<string, number>;
  skipped: string[];
  warnings: string[];
}

export interface IMigrationTrialProgress {
  label: string;
  completed: number;
  total: number;
}

export interface IMigrationStampResult {
  stamped: Array<{ listName: string; itemId: number; title: string; fields: string[] }>;
  warnings: string[];
}

export interface IMigrationBatchResult {
  processed: number;
  succeeded: string[];
  failed: Array<{ migrationKey: string; error: string }>;
  skipped: string[];
  warnings: string[];
  created: Record<string, number>;
  stamped: number;
}

export interface IMigrationDeleteResult {
  deleted: Array<{ listName: string; count: number }>;
  failed: Array<{ listName: string; itemId?: number; error: string }>;
  totalDeleted: number;
}

export interface IMigrationEnsureUsersResult {
  total: number;
  resolved: number;
  failed: Array<{ email: string; error: string }>;
}

export interface IMigrationEnsureUsersFile {
  ensureUsers: Array<{ email: string; source?: string; notes?: string }>;
}

const FALLBACK_USER_EMAIL = "sharepointapps@koniag-gs.com";
const LEGACY_FALLBACK_USER_EMAIL = "sharepointnotifications@koniag-gs.com";

const listMetadata = (listName: string): { __metadata: { type: string } } => ({
  __metadata: { type: `SP.Data.${encodeListName(listName)}ListItem` }
});

const text = (row: MigrationRow, key: string): string => String(row[key] ?? "").trim();
const normalizeMigrationEmail = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  return normalized === LEGACY_FALLBACK_USER_EMAIL ? FALLBACK_USER_EMAIL : normalized;
};

const numberValue = (row: MigrationRow, key: string): number => {
  const value = Number(String(row[key] ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(value) ? value : 0;
};

const boolValue = (row: MigrationRow, key: string): boolean => {
  const value = String(row[key] ?? "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
};

const optionalDate = (row: MigrationRow, key: string): string | undefined => text(row, key) || undefined;
const missingLaborJobId = (row: MigrationRow): string => `MISSING-JOB-ID-${text(row, "resourceMigrationKey").split(":").pop() || "UNKNOWN"}`;
const missingTravelJobId = (row: MigrationRow): string => `MISSING-ODC-JOB-ID-${text(row, "legacyId") || "UNKNOWN"}`;
const delay = (milliseconds: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
const migratedPdfUrl = (row: MigrationRow): string => {
  const value = text(row, "pdfUrl");
  if (!value) {
    return "";
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  const relativePath = value.replace(/^\/+/, "");
  return encodeURI(`${ContextInfo.webAbsoluteUrl}/${relativePath}`);
};
const migrationLog = (message: string): void => {
  console.info(`[IWA Migration] ${message}`);
};

export class MigrationTrialService {
  private static userIdCache = new Map<string, number>();
  private static userCache = new Map<string, { Id?: number; LoginName?: string }>();
  private static context?: WebPartContext;

  static configure(context: WebPartContext): void {
    this.context = context;
  }

  static validatePlan(plan: Partial<IMigrationPlan>): IMigrationPlan {
    const required: Array<keyof IMigrationPlan> = [
      "authorizations",
      "mods",
      "resources",
      "laborLines",
      "travelOdc",
      "workflowRuns",
      "workflowActions"
    ];

    required.forEach((key) => {
      if (!Array.isArray(plan[key])) {
        throw new Error(`Migration plan is missing '${key}'. Upload raw-migration-plan.json from raw-plan-output.`);
      }
    });

    return {
      authorizations: plan.authorizations ?? [],
      mods: plan.mods ?? [],
      resources: plan.resources ?? [],
      laborLines: plan.laborLines ?? [],
      travelOdc: plan.travelOdc ?? [],
      workflowRuns: plan.workflowRuns ?? [],
      workflowActions: plan.workflowActions ?? [],
      issues: Array.isArray(plan.issues) ? plan.issues : []
    };
  }

  static validateEnsureUsersFile(file: Partial<IMigrationEnsureUsersFile>): IMigrationEnsureUsersFile {
    if (!Array.isArray(file.ensureUsers)) {
      throw new Error("Ensure users file must include an 'ensureUsers' array.");
    }

    return {
      ensureUsers: file.ensureUsers
        .map((user) => ({
          email: normalizeMigrationEmail(String(user?.email ?? "")),
          source: user?.source,
          notes: user?.notes
        }))
        .filter((user) => !!user.email)
    };
  }

  static getIssuesForAuthorization(plan: IMigrationPlan, migrationKey: string): MigrationRow[] {
    return (plan.issues ?? []).filter((issue) => text(issue, "authNumber") === migrationKey);
  }

  static getBatchKeys(plan: IMigrationPlan, quantity?: number): string[] {
    const keys = plan.authorizations.map((auth) => text(auth, "migrationKey")).filter(Boolean);
    return quantity && quantity > 0 ? keys.slice(0, quantity) : keys;
  }

  static async importBatch(
    plan: IMigrationPlan,
    quantity: number | undefined,
    allowWarnings: boolean,
    onProgress?: (progress: IMigrationTrialProgress) => void
  ): Promise<IMigrationBatchResult> {
    const keys = this.getBatchKeys(plan, quantity);
    const result = this.emptyBatchResult();

    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      const label = `Importing ${key} (${index + 1} of ${keys.length})...`;
      migrationLog(label);
      onProgress?.({ label, completed: index, total: keys.length });
      try {
        const imported = await this.importOne(plan, key, allowWarnings, (progress) => {
          migrationLog(`${key}: ${progress.label}`);
          onProgress?.({
            label: `${key}: ${progress.label}`,
            completed: index,
            total: keys.length
          });
        });
        result.succeeded.push(key);
        result.skipped.push(...imported.skipped.map((message) => `${key}: ${message}`));
        result.warnings.push(...imported.warnings.map((message) => `${key}: ${message}`));
        Object.entries(imported.created).forEach(([createdKey, value]) => {
          result.created[createdKey] = (result.created[createdKey] ?? 0) + value;
        });
      } catch (error) {
        const message = this.errorMessage(error);
        migrationLog(`${key}: failed - ${message}`);
        if (/already exists as item/i.test(message)) {
          result.skipped.push(`${key}: ${message}`);
        } else {
          result.failed.push({ migrationKey: key, error: message });
        }
      }
      result.processed += 1;
    }

    migrationLog("Batch import complete.");
    onProgress?.({ label: "Batch import complete.", completed: keys.length, total: keys.length });
    return result;
  }

  static async stampBatch(
    plan: IMigrationPlan,
    quantity: number | undefined,
    onProgress?: (progress: IMigrationTrialProgress) => void
  ): Promise<IMigrationBatchResult> {
    const keys = this.getBatchKeys(plan, quantity);
    const result = this.emptyBatchResult();

    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      const label = `Stamping ${key} (${index + 1} of ${keys.length})...`;
      migrationLog(label);
      onProgress?.({ label, completed: index, total: keys.length });
      try {
        const stamped = await this.stampOne(plan, key);
        migrationLog(`${key}: stamped ${stamped.stamped.length} item(s).`);
        result.succeeded.push(key);
        result.stamped += stamped.stamped.length;
        result.warnings.push(...stamped.warnings.map((message) => `${key}: ${message}`));
      } catch (error) {
        const message = this.errorMessage(error);
        migrationLog(`${key}: stamp failed - ${message}`);
        result.failed.push({ migrationKey: key, error: message });
      }
      result.processed += 1;
    }

    migrationLog("Batch stamp complete.");
    onProgress?.({ label: "Batch stamp complete.", completed: keys.length, total: keys.length });
    return result;
  }

  static async deleteAllIwaData(onProgress?: (progress: IMigrationTrialProgress) => void): Promise<IMigrationDeleteResult> {
    const lists = [
      Strings.Sites.main.lists.WorkflowActions,
      Strings.Sites.main.lists.LaborLine,
      Strings.Sites.main.lists.TravelODC,
      Strings.Sites.main.lists.Resources,
      Strings.Sites.main.lists.WorkflowRuns,
      Strings.Sites.main.lists.Mods,
      Strings.Sites.main.lists.Authorizations
    ];
    const result: IMigrationDeleteResult = {
      deleted: [],
      failed: [],
      totalDeleted: 0
    };

    for (let index = 0; index < lists.length; index += 1) {
      const listName = lists[index];
      const label = `Deleting ${listName}...`;
      migrationLog(label);
      onProgress?.({ label, completed: index, total: lists.length });
      const count = await this.deleteAllItemsFromList(listName, result.failed);
      migrationLog(`Deleted ${count} item(s) from ${listName}.`);
      result.deleted.push({ listName, count });
      result.totalDeleted += count;
    }

    migrationLog("Permanent delete complete.");
    onProgress?.({ label: "Permanent delete complete.", completed: lists.length, total: lists.length });
    return result;
  }

  static async ensurePlanUsers(
    plan: IMigrationPlan,
    quantity: number | undefined,
    onProgress?: (progress: IMigrationTrialProgress) => void
  ): Promise<IMigrationEnsureUsersResult> {
    const keys = new Set(this.getBatchKeys(plan, quantity));
    const emails = this.getPlanEmails(plan, keys);
    return this.ensureUserEmails(emails, onProgress);
  }

  static async ensureUserEmails(
    emails: string[],
    onProgress?: (progress: IMigrationTrialProgress) => void
  ): Promise<IMigrationEnsureUsersResult> {
    const uniqueEmails = Array.from(new Set(emails.map((email) => normalizeMigrationEmail(email)).filter(Boolean))).sort();
    const result: IMigrationEnsureUsersResult = { total: uniqueEmails.length, resolved: 0, failed: [] };

    for (let index = 0; index < uniqueEmails.length; index += 1) {
      const email = uniqueEmails[index];
      const label = `Ensuring user ${email} (${index + 1} of ${uniqueEmails.length})...`;
      migrationLog(label);
      onProgress?.({ label, completed: index, total: uniqueEmails.length });
      try {
        const user = await this.tryGetUser(email);
        if (user?.Id) {
          result.resolved += 1;
        } else {
          result.failed.push({ email, error: "No SharePoint user id was returned." });
          migrationLog(`Failed to ensure '${email}': no SharePoint user id was returned.`);
        }
      } catch (error) {
        const message = this.errorMessage(error);
        result.failed.push({ email, error: message });
        migrationLog(`Failed to ensure '${email}': ${message}`);
      }
    }

    migrationLog(`Ensure users complete. Resolved ${result.resolved} of ${result.total}. Failed ${result.failed.length}.`);
    onProgress?.({ label: "Ensure users complete.", completed: uniqueEmails.length, total: uniqueEmails.length });
    return result;
  }

  static async importOne(
    plan: IMigrationPlan,
    migrationKey: string,
    allowWarnings: boolean,
    onProgress?: (progress: IMigrationTrialProgress) => void
  ): Promise<IMigrationTrialResult> {
    const auth = plan.authorizations.find((row) => text(row, "migrationKey") === migrationKey || text(row, "Title") === migrationKey);
    if (!auth) {
      throw new Error(`Could not find authorization '${migrationKey}' in the uploaded plan.`);
    }

    const selectedMods = plan.mods.filter((row) => text(row, "authorizationMigrationKey") === migrationKey);
    const selectedResources = plan.resources.filter((row) => text(row, "authorizationMigrationKey") === migrationKey);
    const selectedLaborLines = plan.laborLines.filter((row) => text(row, "authorizationMigrationKey") === migrationKey);
    const selectedTravelOdc = plan.travelOdc.filter((row) => text(row, "authorizationMigrationKey") === migrationKey);
    const selectedWorkflowRuns = plan.workflowRuns.filter((row) => text(row, "authorizationMigrationKey") === migrationKey);
    const selectedWorkflowActions = plan.workflowActions.filter((row) => text(row, "authorizationMigrationKey") === migrationKey);
    const totalSteps = 1 + selectedMods.length + selectedResources.length + selectedLaborLines.length + selectedTravelOdc.length + selectedWorkflowRuns.length + selectedWorkflowActions.length + 1;
    let completedSteps = 0;
    const report = (label: string): void => {
      migrationLog(`${text(auth, "Title")}: ${label}`);
      onProgress?.({ label, completed: completedSteps, total: totalSteps });
    };
    const finishStep = (label: string): void => {
      completedSteps += 1;
      report(label);
    };

    const authIssues = this.getIssuesForAuthorization(plan, text(auth, "migrationKey"));
    if (authIssues.length && !allowWarnings) {
      throw new Error(`Authorization has ${authIssues.length} warning(s). Review issues.csv or enable 'Allow warnings'.`);
    }

    const existing = await Web().Lists(Strings.Sites.main.lists.Authorizations).Items().query({
      Select: ["Id", "Title"],
      Filter: `Title eq '${text(auth, "Title").replace(/'/g, "''")}'`,
      Top: 1
    }).executeAndWait();

    if (existing?.results?.length) {
      throw new Error(`Authorization '${text(auth, "Title")}' already exists as item ${existing.results[0].Id}.`);
    }

    const skipped: string[] = [];
    const warnings: string[] = [];
    const created = {
      authorizations: 0,
      mods: 0,
      resources: 0,
      laborLines: 0,
      travelOdc: 0,
      workflowRuns: 0,
      workflowActions: 0
    };

    report("Creating authorization header...");
    const authorizationId = await this.createAuthorization(auth, warnings);
    created.authorizations += 1;
    finishStep("Created authorization header.");

    const modIdByKey = new Map<string, number>();
    for (const mod of selectedMods) {
      report(`Creating mod ${numberValue(mod, "modNumber")}...`);
      const modId = await this.createMod(mod, authorizationId);
      modIdByKey.set(text(mod, "migrationKey"), modId);
      created.mods += 1;
      finishStep(`Created mod ${numberValue(mod, "modNumber")}.`);
    }

    const resourceIdByKey = new Map<string, number>();
    for (const resource of selectedResources) {
      report(`Creating resource ${created.resources + 1} of ${selectedResources.length}...`);
      const modId = this.modIdForRow(resource, modIdByKey);
      const resourceId = await this.createResource(resource, authorizationId, modId, warnings);
      resourceIdByKey.set(text(resource, "migrationKey"), resourceId);
      created.resources += 1;
      finishStep(`Created resource ${created.resources} of ${selectedResources.length}.`);
    }

    for (const laborLine of selectedLaborLines) {
      report(`Creating labor line ${created.laborLines + 1} of ${selectedLaborLines.length}...`);
      const resourceId = resourceIdByKey.get(text(laborLine, "resourceMigrationKey"));
      if (!resourceId) {
        skipped.push(`Skipped labor line '${text(laborLine, "migrationKey")}' because its resource was not created.`);
        finishStep(`Skipped labor line ${created.laborLines + skipped.length}.`);
        continue;
      }
      const modId = this.modIdForRow(laborLine, modIdByKey);
      await this.createLaborLine(laborLine, authorizationId, resourceId, modId);
      created.laborLines += 1;
      finishStep(`Created labor line ${created.laborLines} of ${selectedLaborLines.length}.`);
    }

    for (const travel of selectedTravelOdc) {
      report(`Creating travel/ODC line ${created.travelOdc + 1} of ${selectedTravelOdc.length}...`);
      const modId = this.modIdForRow(travel, modIdByKey);
      await this.createTravelOdc(travel, authorizationId, modId);
      created.travelOdc += 1;
      finishStep(`Created travel/ODC line ${created.travelOdc} of ${selectedTravelOdc.length}.`);
    }

    const runIdByKey = new Map<string, number>();
    const modRunIdByModKey = new Map<string, { runId: number; runStatus: string }>();
    for (const run of selectedWorkflowRuns) {
      report(`Creating workflow run ${created.workflowRuns + 1} of ${selectedWorkflowRuns.length}...`);
      const modMigrationKey = text(run, "modMigrationKey");
      const runModId = modIdByKey.get(modMigrationKey);
      const runId = await this.createWorkflowRun(run, authorizationId, runModId, warnings);
      runIdByKey.set(text(run, "migrationKey"), runId);
      if (modMigrationKey) {
        modRunIdByModKey.set(modMigrationKey, { runId, runStatus: text(run, "runStatus") });
      }
      created.workflowRuns += 1;
      finishStep(`Created workflow run ${created.workflowRuns} of ${selectedWorkflowRuns.length}.`);
    }

    for (const [modMigrationKey, runInfo] of modRunIdByModKey.entries()) {
      const modId = modIdByKey.get(modMigrationKey);
      if (modId) {
        const updateBody: Record<string, unknown> = {
          ...listMetadata(Strings.Sites.main.lists.Mods),
          currentWorkflowRunId: runInfo.runId
        };
        if (runInfo.runStatus === "completed") {
          updateBody.effectiveApprovedRunId = runInfo.runId;
        }
        await Web().Lists(Strings.Sites.main.lists.Mods).Items().getById(modId).update(updateBody).executeAndWait();
      }
    }

    for (const action of selectedWorkflowActions) {
      report(`Creating workflow action ${created.workflowActions + 1} of ${selectedWorkflowActions.length}...`);
      const runId = runIdByKey.get(text(action, "workflowRunMigrationKey"));
      if (!runId) {
        skipped.push(`Skipped workflow action '${text(action, "migrationKey")}' because its workflow run was not created.`);
        finishStep(`Skipped workflow action ${created.workflowActions + skipped.length}.`);
        continue;
      }
      const actionModId = modIdByKey.get(text(action, "modMigrationKey"));
      await this.createWorkflowAction(action, authorizationId, runId, actionModId, warnings);
      created.workflowActions += 1;
      finishStep(`Created workflow action ${created.workflowActions} of ${selectedWorkflowActions.length}.`);
    }

    const firstRunId = Array.from(runIdByKey.values())[0];
    if (firstRunId) {
      report("Linking current workflow run...");
      const updateBody: Record<string, unknown> = {
        ...listMetadata(Strings.Sites.main.lists.Authorizations),
        currentWorkflowRunId: firstRunId
      };
      if (text(auth, "authorizationStatus") === "approved") {
        updateBody.effectiveApprovedRunId = firstRunId;
      }
      await Web().Lists(Strings.Sites.main.lists.Authorizations).Items().getById(authorizationId).update(updateBody).executeAndWait();
    }
    finishStep("Import complete.");

    return { authorizationId, created, skipped, warnings };
  }

  static async stampOne(plan: IMigrationPlan, migrationKey: string): Promise<IMigrationStampResult> {
    const auth = plan.authorizations.find((row) => text(row, "migrationKey") === migrationKey || text(row, "Title") === migrationKey);
    if (!auth) {
      throw new Error(`Could not find authorization '${migrationKey}' in the uploaded plan.`);
    }

    const stamped: IMigrationStampResult["stamped"] = [];
    const warnings: string[] = [];
    const authItem = await this.getSingleItemByTitle(Strings.Sites.main.lists.Authorizations, text(auth, "Title"));
    if (!authItem) {
      throw new Error(`Authorization '${text(auth, "Title")}' was not found in SharePoint. Import it before stamping system fields.`);
    }

    const authFields = await this.stampSystemFields(Strings.Sites.main.lists.Authorizations, Number(authItem.Id), auth, warnings, text(auth, "Title"));
    stamped.push({ listName: Strings.Sites.main.lists.Authorizations, itemId: Number(authItem.Id), title: text(auth, "Title"), fields: authFields });

    const mods = plan.mods
      .filter((row) => text(row, "authorizationMigrationKey") === migrationKey)
      .sort((left, right) => numberValue(left, "modNumber") - numberValue(right, "modNumber"));

    for (const mod of mods) {
      const modNumber = numberValue(mod, "modNumber");
      const matches = await Web().Lists(Strings.Sites.main.lists.Mods).Items().query({
        Select: ["Id", "Title", "modNumber"],
        Filter: `authorization/Id eq ${Number(authItem.Id)} and modNumber eq ${modNumber}`,
        Top: 2
      }).executeAndWait();
      const modItem = matches?.results?.[0] as { Id?: number; Title?: string } | undefined;
      if (!modItem?.Id) {
        warnings.push(`Could not find Mod ${modNumber} for '${text(auth, "Title")}' to stamp.`);
        continue;
      }
      const modFields = await this.stampSystemFields(Strings.Sites.main.lists.Mods, Number(modItem.Id), mod, warnings, text(mod, "Title"));
      stamped.push({ listName: Strings.Sites.main.lists.Mods, itemId: Number(modItem.Id), title: text(mod, "Title"), fields: modFields });
    }

    return { stamped, warnings };
  }

  private static async getSingleItemByTitle(listName: string, title: string): Promise<{ Id?: number; Title?: string } | undefined> {
    const result = await Web().Lists(listName).Items().query({
      Select: ["Id", "Title"],
      Filter: `Title eq '${title.replace(/'/g, "''")}'`,
      Top: 1
    }).executeAndWait();
    return result?.results?.[0] as { Id?: number; Title?: string } | undefined;
  }

  private static async deleteAllItemsFromList(listName: string, failed: IMigrationDeleteResult["failed"]): Promise<number> {
    let deleted = 0;
    let keepGoing = true;

    while (keepGoing) {
      const response = await Web().Lists(listName).Items().query({
        Select: ["Id"],
        OrderBy: ["Id asc"],
        Top: 500
      }).executeAndWait();
      const items = (response?.results ?? []) as Array<{ Id?: number }>;
      keepGoing = items.length > 0;

      for (const item of items) {
        const itemId = Number(item.Id);
        if (!itemId) {
          continue;
        }

        try {
          await Web().Lists(listName).Items(itemId).delete().executeAndWait();
          deleted += 1;
        } catch (error) {
          failed.push({ listName, itemId, error: this.errorMessage(error) });
        }
      }

      if (items.length < 500) {
        keepGoing = false;
      }
    }

    return deleted;
  }

  private static async stampSystemFields(listName: string, itemId: number, row: MigrationRow, warnings: string[], context: string): Promise<string[]> {
    const created = text(row, "created");
    const modified = text(row, "modified");
    const author = await this.resolveUserLoginName(text(row, "createdByEmail"), warnings, `${context} created by`);
    const editor = await this.resolveUserLoginName(text(row, "modifiedByEmail"), warnings, `${context} modified by`);
    const formValues: Array<{ FieldName: string; FieldValue: string }> = [];

    if (author) {
      formValues.push({ FieldName: "Author", FieldValue: this.peopleFieldValue(author) });
    }
    if (created) {
      formValues.push({ FieldName: "Created", FieldValue: created });
    }
    if (editor) {
      formValues.push({ FieldName: "Editor", FieldValue: this.peopleFieldValue(editor) });
    }
    if (modified) {
      formValues.push({ FieldName: "Modified", FieldValue: modified });
    }

    if (!formValues.length) {
      warnings.push(`No legacy system fields were available to stamp for '${context}'.`);
      return [];
    }

    const item = Web().Lists(listName).Items().getById(itemId) as unknown as {
      validateUpdateListItem: (
        formValues: Array<{ FieldName: string; FieldValue: string }>,
        bNewDocumentUpdate?: boolean,
        checkInComment?: string,
        datesInUTC?: boolean,
        numberInInvariantCulture?: boolean
      ) => { executeAndWait: () => Promise<unknown> };
    };
    const result = await item.validateUpdateListItem(formValues, true, "", true, true).executeAndWait() as {
      results?: Array<{ FieldName?: string; ErrorMessage?: string; HasException?: boolean }>;
      value?: Array<{ FieldName?: string; ErrorMessage?: string; HasException?: boolean }>;
    };
    const fieldResults = result?.results ?? result?.value ?? [];
    fieldResults
      .filter((field) => field.HasException || field.ErrorMessage)
      .forEach((field) => warnings.push(`Stamp warning for ${listName} item ${itemId} field '${field.FieldName ?? "(unknown)"}': ${field.ErrorMessage ?? "SharePoint reported an exception."}`));

    return formValues.map((field) => field.FieldName);
  }

  private static peopleFieldValue(loginName: string): string {
    return JSON.stringify([{ Key: loginName }]);
  }

  private static emptyBatchResult(): IMigrationBatchResult {
    return {
      processed: 0,
      succeeded: [],
      failed: [],
      skipped: [],
      warnings: [],
      created: {
        authorizations: 0,
        mods: 0,
        resources: 0,
        laborLines: 0,
        travelOdc: 0,
        workflowRuns: 0,
        workflowActions: 0
      },
      stamped: 0
    };
  }

  private static errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error ?? "Unknown error");
  }

  private static modIdForRow(row: MigrationRow, modIdByKey: Map<string, number>): number | undefined {
    if (text(row, "lineScope") !== "mod") {
      return undefined;
    }
    const modNumber = numberValue(row, "modNumber");
    for (const [key, id] of modIdByKey.entries()) {
      if (key.endsWith(`:MOD:${modNumber}`)) {
        return id;
      }
    }
    return undefined;
  }

  private static getPlanEmails(plan: IMigrationPlan, authorizationKeys: Set<string>): string[] {
    const emails = new Set<string>();
    const addEmail = (value: string): void => {
      const normalized = normalizeMigrationEmail(value);
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        emails.add(normalized);
      }
    };
    const includeRow = (row: MigrationRow): boolean => authorizationKeys.has(text(row, "authorizationMigrationKey")) || authorizationKeys.has(text(row, "migrationKey"));

    plan.authorizations
      .filter((row) => authorizationKeys.has(text(row, "migrationKey")))
      .forEach((row) => [
        "pmEmail", "donorGmEmail", "receivingGmEmail", "createdByEmail", "modifiedByEmail"
      ].forEach((field) => addEmail(text(row, field))));
    plan.mods
      .filter(includeRow)
      .forEach((row) => ["createdByEmail", "modifiedByEmail"].forEach((field) => addEmail(text(row, field))));
    plan.resources
      .filter(includeRow)
      .forEach((row) => addEmail(text(row, "employeeEmail")));
    plan.workflowRuns
      .filter(includeRow)
      .forEach((row) => ["pendingApproverEmail", "hrEmail", "ogPresidentEmail", "cfoEmail"].forEach((field) => addEmail(text(row, field))));
    plan.workflowActions
      .filter(includeRow)
      .forEach((row) => addEmail(text(row, "actionByEmail")));

    return Array.from(emails).sort();
  }

  private static async ensureUserId(email: string, warnings: string[], context: string): Promise<number | undefined> {
    return (await this.resolveUserId(email, warnings, context)).id;
  }

  private static async resolveUserId(email: string, warnings: string[], context: string): Promise<{ id?: number; usedFallback: boolean; originalEmail: string }> {
    const normalized = normalizeMigrationEmail(email);
    if (!normalized) {
      return { id: undefined, usedFallback: false, originalEmail: "" };
    }
    migrationLog(`Resolving user id for '${normalized}' (${context}).`);
    const resolved = await this.tryGetUserId(normalized);
    if (resolved) {
      migrationLog(`Resolved user id for '${normalized}' as #${resolved}.`);
      return { id: resolved, usedFallback: false, originalEmail: normalized };
    }
    if (normalized !== FALLBACK_USER_EMAIL) {
      migrationLog(`Could not resolve '${normalized}' for ${context}; falling back to ${FALLBACK_USER_EMAIL}.`);
      warnings.push(`Could not resolve '${email}' for ${context}; used ${FALLBACK_USER_EMAIL}.`);
      const fallbackId = await this.tryGetUserId(FALLBACK_USER_EMAIL);
      if (fallbackId) {
        return { id: fallbackId, usedFallback: true, originalEmail: normalized };
      }
    }
    throw new Error(`Could not resolve SharePoint user '${email}' or fallback '${FALLBACK_USER_EMAIL}'.`);
  }

  private static async tryGetUserId(email: string): Promise<number | undefined> {
    const normalized = normalizeMigrationEmail(email);
    if (!normalized) {
      return undefined;
    }
    const cached = this.userIdCache.get(normalized);
    if (cached) {
      return cached;
    }
    const user = await this.tryGetUser(normalized);
    return user?.Id;
  }

  private static async resolveUserLoginName(email: string, warnings: string[], context: string): Promise<string | undefined> {
    const normalized = normalizeMigrationEmail(email);
    if (!normalized) {
      return undefined;
    }
    const user = await this.tryGetUser(normalized);
    if (user?.LoginName) {
      return user.LoginName;
    }
    if (normalized !== FALLBACK_USER_EMAIL) {
      warnings.push(`Could not resolve '${email}' for ${context}; used ${FALLBACK_USER_EMAIL}.`);
      const fallback = await this.tryGetUser(FALLBACK_USER_EMAIL);
      if (fallback?.LoginName) {
        return fallback.LoginName;
      }
    }
    throw new Error(`Could not resolve SharePoint user '${email}' or fallback '${FALLBACK_USER_EMAIL}'.`);
  }

  private static async tryGetUser(email: string): Promise<{ Id?: number; LoginName?: string } | undefined> {
    const normalized = normalizeMigrationEmail(email);
    if (!normalized) {
      return undefined;
    }
    const cached = this.userCache.get(normalized);
    if (cached?.Id) {
      migrationLog(`Resolved user '${normalized}' from migration cache as #${cached.Id}.`);
      return cached;
    }

    migrationLog(`Trying REST ensureuser for '${normalized}'.`);
    const ensured = await this.tryEnsureUser(normalized);
    if (ensured?.Id) {
      return ensured;
    }

    migrationLog(`Trying People Picker lookup for '${normalized}'.`);
    const pickerUser = await this.tryResolveUserWithPeoplePicker(normalized);
    if (pickerUser?.Id) {
      return pickerUser;
    }

    migrationLog(`Trying SiteUsers/getByEmail for '${normalized}'.`);
    try {
      const user = await Web().SiteUsers().getByEmail(normalized).executeAndWait() as { Id?: number; LoginName?: string };
      if (user?.Id) {
        this.userIdCache.set(normalized, user.Id);
        this.userCache.set(normalized, user);
        migrationLog(`Resolved user '${normalized}' from site users as #${user.Id}.`);
      }
      return user;
    } catch (error) {
      migrationLog(`SiteUsers/getByEmail failed for '${normalized}': ${this.errorMessage(error)}`);
    }

    return undefined;
  }

  private static async postSharePointJson<TResponse>(url: string, body: Record<string, unknown>): Promise<TResponse | undefined> {
    if (!this.context) {
      throw new Error("MigrationTrialService was not configured with the SPFx web part context.");
    }
    const options: ISPHttpClientOptions = {
      headers: {
        Accept: "application/json;odata=verbose",
        "Content-Type": "application/json;odata=verbose"
      },
      body: JSON.stringify(body)
    };
    const response = await this.context.spHttpClient.post(url, SPHttpClient.configurations.v1, options);

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return await response.json() as TResponse;
  }

  private static async tryResolveUserWithPeoplePicker(email: string): Promise<{ Id?: number; LoginName?: string } | undefined> {
    const normalized = normalizeMigrationEmail(email);
    try {
      const url = `${ContextInfo.webAbsoluteUrl}/_api/SP.UI.ApplicationPages.ClientPeoplePickerWebServiceInterface.ClientPeoplePickerSearchUser`;
      const response = await this.postSharePointJson<{
        d?: { ClientPeoplePickerSearchUser?: string };
        ClientPeoplePickerSearchUser?: string;
      }>(url, {
        queryParams: {
          __metadata: { type: "SP.UI.ApplicationPages.ClientPeoplePickerQueryParameters" },
          AllowEmailAddresses: true,
          AllowMultipleEntities: false,
          AllUrlZones: false,
          MaximumEntitySuggestions: 10,
          PrincipalSource: 15,
          PrincipalType: 1,
          QueryString: normalized
        }
      });
      const payload = response?.d?.ClientPeoplePickerSearchUser ?? response?.ClientPeoplePickerSearchUser ?? "[]";
      const matches = JSON.parse(payload) as Array<{ Key?: string; Description?: string; EntityData?: { Email?: string } }>;
      const match = matches.find((candidate) => {
        const candidateEmail = candidate.EntityData?.Email || candidate.Description || "";
        return candidateEmail.toLowerCase() === normalized || candidate.Key?.toLowerCase().includes(normalized);
      }) ?? matches[0];

      if (!match?.Key) {
        migrationLog(`People Picker did not return a usable key for '${normalized}'.`);
        return undefined;
      }

      migrationLog(`People Picker resolved '${normalized}' to '${match.Key}'.`);
      return await this.tryEnsureUserWithLogin(match.Key, normalized);
    } catch (error) {
      migrationLog(`People Picker lookup failed for '${normalized}': ${this.errorMessage(error)}`);
      return undefined;
    }
  }

  private static async tryEnsureUser(email: string): Promise<{ Id?: number; LoginName?: string } | undefined> {
    const normalized = normalizeMigrationEmail(email);
    return this.tryEnsureUserWithLogin(normalized, normalized);
  }

  private static async tryEnsureUserWithLogin(loginName: string, cacheKey: string): Promise<{ Id?: number; LoginName?: string } | undefined> {
    const normalized = normalizeMigrationEmail(cacheKey);
    const trimmedLoginName = loginName.trim();
    const candidates = [
      trimmedLoginName,
      `i:0#.f|membership|${normalized}`
    ].filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);

    for (const candidate of candidates) {
      migrationLog(`Trying gd-sprest ensureUser for '${normalized}' with key '${candidate}'.`);
      try {
        const user = await Web().ensureUser(candidate).executeAndWait() as { Id?: number; LoginName?: string };
        if (user?.Id) {
          this.userIdCache.set(normalized, user.Id);
          this.userCache.set(normalized, user);
          migrationLog(`Ensured user '${normalized}' with gd-sprest key '${candidate}' as #${user.Id}.`);
          return user;
        }
      } catch (error) {
        migrationLog(`gd-sprest ensureUser failed for '${normalized}' with key '${candidate}': ${this.errorMessage(error)}`);
      }

      migrationLog(`Trying REST ensureuser for '${normalized}' with key '${candidate}'.`);
      try {
        const user = await this.tryEnsureUserRest(candidate, normalized);
        if (user?.Id) {
          return user;
        }
      } catch (error) {
        migrationLog(`REST ensureuser failed for '${normalized}' with key '${candidate}': ${this.errorMessage(error)}`);
      }
    }

    await delay(250);
    try {
      const user = await Web().SiteUsers().getByEmail(normalized).executeAndWait() as { Id?: number; LoginName?: string };
      if (user?.Id) {
        this.userIdCache.set(normalized, user.Id);
        this.userCache.set(normalized, user);
        migrationLog(`Resolved user '${normalized}' after ensure as #${user.Id}.`);
      }
      return user;
    } catch {
      return undefined;
    }
  }

  private static async tryEnsureUserRest(loginName: string, cacheKey: string): Promise<{ Id?: number; LoginName?: string } | undefined> {
    const response = await this.postSharePointJson<{
      d?: { Id?: number; LoginName?: string };
      Id?: number;
      LoginName?: string;
    }>(`${ContextInfo.webAbsoluteUrl}/_api/web/ensureuser`, { logonName: loginName });
    const user = response?.d ?? response;
    if (user?.Id) {
      this.userIdCache.set(cacheKey, user.Id);
      this.userCache.set(cacheKey, user);
      migrationLog(`Ensured user '${cacheKey}' with REST key '${loginName}' as #${user.Id}.`);
      return user;
    }
    return undefined;
  }

  private static async createAuthorization(row: MigrationRow, warnings: string[]): Promise<number> {
    const listName = Strings.Sites.main.lists.Authorizations;
    const body: Record<string, unknown> = {
      ...listMetadata(listName),
      Title: text(row, "Title"),
      authorizationStatus: text(row, "authorizationStatus"),
      pmId: await this.ensureUserId(text(row, "pmEmail"), warnings, `${text(row, "Title")} PM`),
      donorEntity: text(row, "donorEntity"),
      donorEntityAbbr: text(row, "donorEntityAbbr"),
      donorGmId: await this.ensureUserId(text(row, "donorGmEmail"), warnings, `${text(row, "Title")} donor GM`),
      receivingEntity: text(row, "receivingEntity"),
      receivingEntityAbbr: text(row, "receivingEntityAbbr"),
      receivingGmId: await this.ensureUserId(text(row, "receivingGmEmail"), warnings, `${text(row, "Title")} receiving GM`),
      og: text(row, "og"),
      lob: text(row, "lob"),
      contractName: text(row, "contractName"),
      contractId: text(row, "contractId"),
      iwaJamisProjectId: text(row, "iwaJamisProjectId"),
      customerContractCode: text(row, "customerContractCode"),
      invoice: text(row, "invoice"),
      contractType: text(row, "contractType"),
      periodStart: optionalDate(row, "periodStart"),
      periodEnd: optionalDate(row, "periodEnd"),
      scopeOfWork: text(row, "scopeOfWork"),
      justification: text(row, "justification"),
      notes: text(row, "notes"),
      pdfUrl: migratedPdfUrl(row),
      baseLaborAmount: numberValue(row, "baseLaborAmount"),
      baseTravelAmount: numberValue(row, "baseTravelAmount"),
      baseGrandTotal: numberValue(row, "baseGrandTotal"),
      approvedLaborAmount: numberValue(row, "approvedLaborAmount"),
      approvedTravelAmount: numberValue(row, "approvedTravelAmount"),
      approvedGrandTotal: numberValue(row, "approvedGrandTotal"),
      modCount: numberValue(row, "modCount"),
      approvedOn: optionalDate(row, "approvedOn"),
      rejectedOn: optionalDate(row, "rejectedOn")
    };
    const item = await Web().Lists(listName).Items().add(body).executeAndWait();
    return Number(item.Id);
  }

  private static async createMod(row: MigrationRow, authorizationId: number): Promise<number> {
    const listName = Strings.Sites.main.lists.Mods;
    const item = await Web().Lists(listName).Items().add({
      ...listMetadata(listName),
      Title: text(row, "Title"),
      authorizationId,
      modNumber: numberValue(row, "modNumber"),
      modStatus: text(row, "modStatus"),
      reason: text(row, "reason"),
      changeSummary: text(row, "changeSummary"),
      notes: text(row, "notes"),
      pdfUrl: migratedPdfUrl(row),
      laborAmount: numberValue(row, "laborAmount"),
      travelAmount: numberValue(row, "travelAmount"),
      grandTotal: numberValue(row, "grandTotal"),
      approvedOn: optionalDate(row, "approvedOn"),
      rejectedOn: optionalDate(row, "rejectedOn")
    }).executeAndWait();
    return Number(item.Id);
  }

  private static async createResource(row: MigrationRow, authorizationId: number, modId: number | undefined, warnings: string[]): Promise<number> {
    const listName = Strings.Sites.main.lists.Resources;
    const employee = await this.resolveUserId(
      text(row, "employeeEmail"),
      warnings,
      `${text(row, "authorizationMigrationKey")} resource ${text(row, "legacyResourceId")}`
    );
    const comments = [
      text(row, "comments"),
      employee.usedFallback && employee.originalEmail
        ? `Legacy employee email could not be resolved in SharePoint: ${employee.originalEmail}`
        : ""
    ].filter(Boolean).join("\n");
    const body: Record<string, unknown> = {
      ...listMetadata(listName),
      Title: text(row, "Title"),
      authorizationId,
      lineScope: text(row, "lineScope"),
      lineNumber: numberValue(row, "lineNumber"),
      displayOrder: numberValue(row, "displayOrder"),
      isActive: true,
      employeeId: employee.id,
      state: text(row, "state"),
      laborCategory: text(row, "laborCategory"),
      comments
    };
    if (modId) {
      body.modId = modId;
    }
    const item = await Web().Lists(listName).Items().add(body).executeAndWait();
    if (comments) {
      try {
        await Web().Lists(listName).Items().getById(Number(item.Id)).update({
          ...listMetadata(listName),
          comments
        }).executeAndWait();
      } catch {
        warnings.push(`Created resource '${text(row, "migrationKey")}', but could not update its comments field.`);
      }
    }
    return Number(item.Id);
  }

  private static async createLaborLine(row: MigrationRow, authorizationId: number, resourceId: number, modId?: number): Promise<void> {
    const listName = Strings.Sites.main.lists.LaborLine;
    const body: Record<string, unknown> = {
      ...listMetadata(listName),
      Title: text(row, "Title"),
      authorizationId,
      lineScope: text(row, "lineScope"),
      lineNumber: numberValue(row, "lineNumber"),
      displayOrder: numberValue(row, "displayOrder"),
      isActive: true,
      pricingType: text(row, "pricingType"),
      jobId: text(row, "jobId") || missingLaborJobId(row),
      resourcesId: { results: [resourceId] },
      standardRate: numberValue(row, "standardRate"),
      standardHours: numberValue(row, "standardHours"),
      standardAmount: numberValue(row, "standardAmount"),
      lumpSumAmount: numberValue(row, "lumpSumAmount"),
      totalAmount: numberValue(row, "totalAmount"),
      comments: text(row, "comments")
    };
    if (modId) {
      body.modId = modId;
    }
    await Web().Lists(listName).Items().add(body).executeAndWait();
  }

  private static async createTravelOdc(row: MigrationRow, authorizationId: number, modId?: number): Promise<void> {
    const listName = Strings.Sites.main.lists.TravelODC;
    const body: Record<string, unknown> = {
      ...listMetadata(listName),
      Title: text(row, "Title"),
      authorizationId,
      lineScope: text(row, "lineScope"),
      lineNumber: numberValue(row, "lineNumber"),
      displayOrder: numberValue(row, "displayOrder"),
      isActive: true,
      lineType: text(row, "lineType"),
      jobId: text(row, "jobId") || missingTravelJobId(row),
      description: text(row, "description"),
      amount: numberValue(row, "amount"),
      comments: text(row, "comments")
    };
    if (modId) {
      body.modId = modId;
    }
    await Web().Lists(listName).Items().add(body).executeAndWait();
  }

  private static async createWorkflowRun(row: MigrationRow, authorizationId: number, modId: number | undefined, warnings: string[]): Promise<number> {
    const listName = Strings.Sites.main.lists.WorkflowRuns;
    const pendingApproverId = await this.ensureUserId(text(row, "pendingApproverEmail"), warnings, `${text(row, "Title")} pending approver`);
    const body: Record<string, unknown> = {
      ...listMetadata(listName),
      Title: text(row, "Title"),
      authorizationId,
      runNumber: numberValue(row, "runNumber"),
      runType: text(row, "runType"),
      runStatus: text(row, "runStatus"),
      hasDecision: boolValue(row, "hasDecision"),
      outcome: text(row, "outcome"),
      currentStepKey: text(row, "currentStepKey"),
      pendingRole: text(row, "pendingRole"),
      pendingApproverId,
      stepAssignedDate: optionalDate(row, "stepAssignedDate"),
      completedOn: optionalDate(row, "completedOn"),
      skipPmStep: boolValue(row, "skipPmStep"),
      hrId: await this.ensureUserId(text(row, "hrEmail"), warnings, `${text(row, "Title")} HR`),
      ogPresidentId: await this.ensureUserId(text(row, "ogPresidentEmail"), warnings, `${text(row, "Title")} OG president`),
      cfoId: await this.ensureUserId(text(row, "cfoEmail"), warnings, `${text(row, "Title")} CFO`)
    };
    if (modId) {
      body.modId = modId;
    }
    const item = await Web().Lists(listName).Items().add(body).executeAndWait();
    return Number(item.Id);
  }

  private static async createWorkflowAction(row: MigrationRow, authorizationId: number, workflowRunId: number, modId: number | undefined, warnings: string[]): Promise<void> {
    const listName = Strings.Sites.main.lists.WorkflowActions;
    const actionBy = await this.resolveUserId(text(row, "actionByEmail"), warnings, `${text(row, "Title")} action by`);
    const comments = [
      text(row, "comments"),
      actionBy.usedFallback && actionBy.originalEmail
        ? `Legacy action by email could not be resolved in SharePoint: ${actionBy.originalEmail}`
        : ""
    ].filter(Boolean).join("\n");
    const body: Record<string, unknown> = {
      ...listMetadata(listName),
      Title: text(row, "Title"),
      authorizationId,
      workflowRunId,
      stepKey: text(row, "stepKey"),
      actionType: text(row, "actionType"),
      actionById: actionBy.id,
      actionDate: optionalDate(row, "actionDate"),
      role: text(row, "role"),
      comments
    };
    if (modId) {
      body.modId = modId;
    }
    await Web().Lists(listName).Items().add(body).executeAndWait();
  }
}
