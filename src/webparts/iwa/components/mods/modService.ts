import { Web } from "gd-sprest";
import { IModItem } from "../data/props";
import Strings from "../common/strings";
import { encodeListName, formatError } from "../common/utils";
import { LaborLineItemService } from "../laborlineitems/laborLineItemService";
import { ResourceService } from "../resources/resourceService";
import { TravelOdcService } from "../travelodc/travelOdcService";

interface ICreateModOptions {
    authorizationId: number;
    authorizationTitle: string;
    modNumber: number;
    modStatus?: IModItem["modStatus"];
    reason?: string;
    changeSummary?: string;
    notes?: string;
    laborAmount?: number;
    travelAmount?: number;
    grandTotal?: number;
}

export class ModService {

    private static readonly selectQuery: string[] = [
        "Id", "Title", "modNumber",
        "modStatus", "reason", "changeSummary",
        "notes", "laborAmount", "travelAmount",
        "grandTotal", "pdfUrl", "pdfGeneratedOn",
        "approvedOn", "rejectedOn", "canceledOn",
        "Created", "Modified", "Author/Id", "Author/Title", "Author/EMail", "authorization/Id",
        "authorization/Title", "currentWorkflowRun/Id", "currentWorkflowRun/Title",
        "effectiveApprovedRun/Id", "effectiveApprovedRun/Title"
    ];

    private static readonly expandQuery: string[] = ["Author", "authorization", "currentWorkflowRun", "effectiveApprovedRun"];

    static getById(modId: number): Promise<IModItem> {
        return new Promise<IModItem>((resolve, reject) => {
            Web().Lists(Strings.Sites.main.lists.Mods).Items().getById(modId).query({
                Select: this.selectQuery,
                Expand: this.expandQuery
            }).execute(
                (item) => resolve(item as unknown as IModItem),
                (error) => reject(new Error(`Mod was saved but failed to reload it: ${formatError(error)}`))
            );
        });
    }

    static getByAuthorization(authorizationId: number): Promise<IModItem[]> {
        return new Promise<IModItem[]>((resolve, reject) => {
            Web().Lists(Strings.Sites.main.lists.Mods).Items().query({
                Select: this.selectQuery,
                Expand: this.expandQuery,
                Filter: `authorization/Id eq ${authorizationId}`,
                OrderBy: ["modNumber asc"],
                Top: 5000
            }).execute(
                (items) => resolve((items?.results ?? []) as unknown as IModItem[]),
                (error) => reject(new Error(`Error fetching Mods by Authorization: ${formatError(error)}`))
            );
        });
    }

    static getAll(): Promise<IModItem[]> {
        return new Promise<IModItem[]>((resolve, reject) => {
            Web().Lists(Strings.Sites.main.lists.Mods).Items().query({
                GetAllItems: true,
                Select: this.selectQuery,
                Expand: this.expandQuery,
                OrderBy: ["modNumber desc", "Created desc"],
                Top: 5000
            }).execute(
                (items) => resolve((items?.results ?? []) as unknown as IModItem[]),
                (error) => reject(new Error(`Error fetching Mods: ${formatError(error)}`))
            );
        });
    }

    static async create(options: ICreateModOptions): Promise<IModItem> {
        const title = `${options.authorizationTitle}-MOD-${String(options.modNumber).padStart(2, "0")}`;
        const response = await Web().Lists(Strings.Sites.main.lists.Mods).Items().add({
            __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Mods)}ListItem` },
            Title: title,
            authorizationId: options.authorizationId,
            modNumber: options.modNumber,
            modStatus: options.modStatus ?? "draft",
            reason: options.reason ?? "",
            changeSummary: options.changeSummary ?? "",
            notes: options.notes ?? "",
            laborAmount: options.laborAmount ?? 0,
            travelAmount: options.travelAmount ?? 0,
            grandTotal: options.grandTotal ?? 0
        }).executeAndWait();

        if (!response?.Id) {
            throw new Error("Mod was created but response did not include an Id. Please refresh.");
        }

        return this.getById(response.Id);
    }

    static async updateDraft(
        modId: number,
        values: {
            reason?: string;
            changeSummary?: string;
            notes?: string;
            laborAmount?: number;
            travelAmount?: number;
            grandTotal?: number;
            modStatus?: IModItem["modStatus"];
            currentWorkflowRunId?: number;
        }
    ): Promise<void> {
        if (!modId) {
            throw new Error("Cannot update Mod draft: mod.Id is missing.");
        }

        const updateBody: Record<string, unknown> = {
            __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Mods)}ListItem` }
        };

        if (values.reason !== undefined) {
            updateBody.reason = values.reason;
        }

        if (values.changeSummary !== undefined) {
            updateBody.changeSummary = values.changeSummary;
        }

        if (values.notes !== undefined) {
            updateBody.notes = values.notes;
        }

        if (values.laborAmount !== undefined) {
            updateBody.laborAmount = values.laborAmount;
        }

        if (values.travelAmount !== undefined) {
            updateBody.travelAmount = values.travelAmount;
        }

        if (values.grandTotal !== undefined) {
            updateBody.grandTotal = values.grandTotal;
        }

        if (values.modStatus !== undefined) {
            updateBody.modStatus = values.modStatus;
        }

        if (values.currentWorkflowRunId !== undefined) {
            updateBody.currentWorkflowRunId = values.currentWorkflowRunId;
        }

        await Web().Lists(Strings.Sites.main.lists.Mods).Items().getById(modId).update(updateBody).executeAndWait();
    }

    static async updateRunId(modId: number, currentRunId: number): Promise<void> {
        if (!modId || !currentRunId) {
            throw new Error("Cannot update Mod workflow run: mod.Id or run.Id is missing.");
        }

        await Web().Lists(Strings.Sites.main.lists.Mods).Items().getById(modId).update({
            __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Mods)}ListItem` },
            currentWorkflowRunId: currentRunId
        }).executeAndWait();
    }

    static async updateWorkflowStatus(
        modId: number,
        modStatus: IModItem["modStatus"],
        effectiveApprovedRunId?: number
    ): Promise<void> {
        if (!modId) {
            throw new Error("Cannot update Mod workflow status: mod.Id is missing.");
        }

        const nowIso = new Date().toISOString();
        const updateBody: Record<string, unknown> = {
            __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Mods)}ListItem` },
            modStatus
        };

        if (modStatus === "approved") {
            updateBody.approvedOn = nowIso;
            updateBody.rejectedOn = null;
        }

        if (modStatus === "rejected") {
            updateBody.rejectedOn = nowIso;
        }

        if (effectiveApprovedRunId !== undefined) {
            updateBody.effectiveApprovedRunId = effectiveApprovedRunId;
        }

        await Web().Lists(Strings.Sites.main.lists.Mods).Items().getById(modId).update(updateBody).executeAndWait();
    }

    static async discardDraft(authorizationId: number, modId: number): Promise<void> {
        if (!authorizationId || !modId) {
            throw new Error("Cannot discard Mod draft: authorization.Id or mod.Id is missing.");
        }

        await Promise.all([
            ResourceService.deleteForMod(authorizationId, modId),
            LaborLineItemService.deleteForMod(authorizationId, modId),
            TravelOdcService.deleteForMod(authorizationId, modId)
        ]);

        await Web().Lists(Strings.Sites.main.lists.Mods).Items(modId).recycle().executeAndWait();
    }
}
