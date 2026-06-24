import { AuthorizationStatus, ICounterItem, IAuthorizationItem } from "../data/props";
import { Web } from "gd-sprest";
import Strings from "../common/strings";
import { formatError, encodeListName } from "../common/utils";
import { SharePointUserResolver } from "../common/sharePointUserResolver";
import dayjs from 'dayjs';
import { DataSource } from "../data/ds";
import { Base } from "gd-sprest/@types/intellisense";
import { LaborLineItemService } from "../laborlineitems/laborLineItemService";
import { TravelOdcService } from "../travelodc/travelOdcService";
import { ModService } from "../mods/modService";

type IExecWithHeaders<T> = Base.IBaseExecution<T> & {
  headers?: { [key: string]: string };
};

export class AuthorizationService {

  static getById(authorizationId: number): Promise<IAuthorizationItem> {
    return new Promise<IAuthorizationItem>((resolve, reject) => {
      Web().Lists(Strings.Sites.main.lists.Authorizations).Items().getById(authorizationId).query({
        Select: DataSource.authorizationSelectQuery,
        Expand: DataSource.authorizationExpandQuery
      }).execute(
        (item) => resolve(item as unknown as IAuthorizationItem),
        (error) => reject(new Error(`Error fetching Authorization ${authorizationId}: ${formatError(error)}`))
      );
    });
  }

  // create the temp draft when NEW form opens to hold attachments
  static async createDraft(): Promise<number | undefined> {
    const item = await Web().Lists(Strings.Sites.main.lists.Authorizations).Items().add({
      Title: "Draft",
      authorizationStatus: "draft"
    }).executeAndWait();

    return item.Id ?? undefined;
  }

  // only on initial submit, load the counter for current year, create new one for new year
  static async reserveNextSequence(year: string, authorizationId: number): Promise<number> {

    const listName = Strings.Sites.main.lists.Counters;
    const LIST = Web().Lists(listName);
    const maxRetries = 6;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {

      // 1. Load counter for year
      const counter: ICounterItem | undefined = await new Promise<ICounterItem | undefined>((resolve, reject) => {
        LIST
          .Items()
          .query({
            Select: ["Id", "Title", "currentId", "currentSeq", "nextSeq"],
            Filter: `Title eq '${year}'`,
            Top: 1
          })
          .execute(
            (items) => resolve(items?.results?.[0] as unknown as ICounterItem | undefined),
            (error) => reject(new Error(`Error loading counter for ${year}: ${formatError(error)}`))
          );
      });

      // 2. Create counter if it doesn’t exist
      const workingCounter: ICounterItem = counter ?? await new Promise<ICounterItem>((resolve, reject) => {
        LIST
          .Items()
          .add({
            Title: year,
            currentId: 0,
            currentSeq: 0,
            nextSeq: 1
          })
          .execute(
            (item) => resolve(item as unknown as ICounterItem),
            (error) => reject(new Error(`Error creating counter for ${year}: ${formatError(error)}`))
          );
      });

      const allocatedSeq: number = workingCounter.nextSeq ?? 1;
      const newNextSeq: number = allocatedSeq + 1;
      const etag: string = workingCounter.__metadata?.etag ?? "*";

      console.log(`Attempt ${attempt}: reserving seq ${allocatedSeq} for authorization ${authorizationId} (ETag: ${etag})`);

      // 3. Update Counter list with new sequence and return the 
      try {

        const req = LIST
          .Items()
          .getById(workingCounter.Id)
          .update({
            __metadata: { type: `SP.Data.${encodeListName(listName)}ListItem` },
            currentId: authorizationId,
            currentSeq: allocatedSeq,
            nextSeq: newNextSeq
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as unknown as IExecWithHeaders<any>;

        // Attach IF-MATCH header for optimistic concurrency
        req.headers = req.headers ?? {};
        req.headers["IF-MATCH"] = etag;

        await new Promise<void>((resolve, reject) => {
          req.execute(
            () => resolve(),
            (error) => reject(error)
          );
        });

        console.log(`Sequence ${allocatedSeq} successfully reserved for authorization ${authorizationId}`);

        return allocatedSeq;

      } catch (error: unknown) {

        const msg = String(error);

        console.warn(`Sequence reservation attempt ${attempt} failed:`, msg);

        // 412 = ETag mismatch (someone else updated first)
        if (msg.includes("412") || msg.toLowerCase().includes("precondition")) {
          continue; // retry
        }

        throw new Error(`Error reserving sequence for ${year}: ${formatError(error)}`);
      }
    }

    throw new Error(`Unable to reserve tracking number for ${year}. Please try again.`);
  }

  // shared private updater
  private static async updateAuthorization(item: IAuthorizationItem, authorizationStatus: AuthorizationStatus, trackingTitle?: string): Promise<IAuthorizationItem> {
    const [
      backupRequestorId,
      pmId,
      donorGmId,
      receivingGmId
    ] = await Promise.all([
      SharePointUserResolver.resolvePersonIdForCurrentWeb(item.backupRequestor, item.backupRequestor?.Id, "authorization backup requestor"),
      SharePointUserResolver.resolvePersonIdForCurrentWeb(item.pm, item.pm?.Id, "authorization PM"),
      SharePointUserResolver.resolvePersonIdForCurrentWeb(item.donorGm, item.donorGm?.Id, "authorization donor GM"),
      SharePointUserResolver.resolvePersonIdForCurrentWeb(item.receivingGm, item.receivingGm?.Id, "authorization receiving GM")
    ]);

    return new Promise<IAuthorizationItem>((resolve, reject) => {

      // Keep form saves limited to user-editable header fields. Derived/system
      // fields are updated by their dedicated service methods so stale form
      // state cannot overwrite newer workflow, total, Mod, or PDF values.
      //
      // Person fields are deliberately resolved before this payload is built.
      // SharePoint writes FieldNameId as a site-collection-local User
      // Information List lookup, so IDs from JAMIS/config/lookup site
      // collections cannot be copied directly into the app site's lists.
      const updateBody: Record<string, unknown> = {
        __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Authorizations)}ListItem` },
        authorizationStatus,
        backupRequestorId,
        pmId,
        donorEntity: item.donorEntity,
        donorEntityAbbr: item.donorEntityAbbr ?? "",
        donorGmId,
        receivingEntity: item.receivingEntity,
        receivingEntityAbbr: item.receivingEntityAbbr ?? "",
        receivingGmId,
        og: item.og ?? "",
        lob: item.lob ?? "",
        contractName: item.contractName,
        contractId: item.contractId,
        customerContractCode: item.customerContractCode ?? "",
        naicsCode: item.naicsCode ?? "",
        invoice: item.invoice ?? "",
        contractType: item.contractType,
        periodStart: item.periodStart || null,
        periodEnd: item.periodEnd || null,
        scopeOfWork: item.scopeOfWork ?? "",
        justification: item.justification ?? "",
        notes: item.notes ?? ""
      };

      if (trackingTitle) {
        updateBody.Title = trackingTitle;
      }

      Web().Lists(Strings.Sites.main.lists.Authorizations).Items().getById(item.Id).update(updateBody).execute(
        (resp) => {
          if (!resp?.existsFl) {
            reject(new Error("Authorization was updated but response did not include a success message. Please refresh."));
            return;
          }

          Web().Lists(Strings.Sites.main.lists.Authorizations).Items().getById(item.Id).query({
            Select: DataSource.authorizationSelectQuery,
            Expand: DataSource.authorizationExpandQuery
          }).execute(
            (iwa) => resolve(iwa as unknown as IAuthorizationItem),
            (error) => reject(new Error(`Authorization updated but failed to re-fetch it: ${formatError(error)}`))
          );
        },
        (error) => reject(new Error(`Error updating Authorization ${item.Id}: ${formatError(error)}`))
      );
    });
  }

  // only for new authorizations
  static async submitNew(item: IAuthorizationItem, authorizationStatus: AuthorizationStatus): Promise<IAuthorizationItem> {
    const year = dayjs().format("YYYY");
    const seq = await this.reserveNextSequence(year, item.Id);
    const trackingNo = seq.toString().padStart(4, "0");
    const iwaNo = `IWA-${item.receivingEntityAbbr}-${item.donorEntityAbbr}-${year}-${trackingNo}`;

    // update item with tracking + everything else
    return await this.updateAuthorization(item, authorizationStatus, iwaNo);
  }

  // standard edit authorization
  static async edit(item: IAuthorizationItem, authorizationStatus: AuthorizationStatus): Promise<IAuthorizationItem> {
    return await this.updateAuthorization(item, authorizationStatus);
  }

  // Update the current Run Id for Mod Review after new run is created successfully
  static async updateRunId(itemId: number, currentRunId: number): Promise<void> {

    if (!itemId || !currentRunId) {
      throw new Error("Cannot submit authorization workflow run: item.Id or run.Id is missing. Refresh and try again or contact IT support.");
    }

    try {

      await Web().Lists(Strings.Sites.main.lists.Authorizations).Items().getById(itemId).update({
        __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Authorizations)}ListItem` },
        currentWorkflowRunId: currentRunId
      }).executeAndWait();

    } catch (error) {
      const err = formatError(error);
      console.error("Error updating IWA > Run Id: ", error);
      throw new Error(`Error submitting IWA > Run Id: ${err}`);
    }
  }

  static async updateModCount(itemId: number, modCount: number): Promise<void> {
    if (!itemId) {
      throw new Error("Cannot update authorization mod count: item.Id is missing.");
    }

    try {
      await Web().Lists(Strings.Sites.main.lists.Authorizations).Items().getById(itemId).update({
        __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Authorizations)}ListItem` },
        modCount
      }).executeAndWait();
    } catch (error) {
      const err = formatError(error);
      console.error("Error updating IWA mod count: ", error);
      throw new Error(`Error updating IWA mod count: ${err}`);
    }
  }

  static async recalculateModCount(itemId: number): Promise<number> {
    if (!itemId) {
      throw new Error("Cannot recalculate authorization mod count: item.Id is missing.");
    }

    const mods = await ModService.getByAuthorization(itemId);
    const modCount = Math.max(0, ...(mods ?? []).map((mod) => mod.modNumber ?? 0));
    await this.updateModCount(itemId, modCount);

    return modCount;
  }

  static async updateBaseAmounts(
    itemId: number,
    amounts: {
      baseLaborAmount: number;
      baseTravelAmount: number;
      baseGrandTotal: number;
    }
  ): Promise<void> {

    if (!itemId) {
      throw new Error("Cannot update authorization totals: item.Id is missing.");
    }

    try {
      await Web().Lists(Strings.Sites.main.lists.Authorizations).Items().getById(itemId).update({
        __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Authorizations)}ListItem` },
        baseLaborAmount: amounts.baseLaborAmount,
        baseTravelAmount: amounts.baseTravelAmount,
        baseGrandTotal: amounts.baseGrandTotal
      }).executeAndWait();

    } catch (error) {
      const err = formatError(error);
      console.error("Error updating IWA base totals: ", error);
      throw new Error(`Error updating IWA base totals: ${err}`);
    }
  }

  static async recalculateBaseAmounts(itemId: number): Promise<{
    baseLaborAmount: number;
    baseTravelAmount: number;
    baseGrandTotal: number;
  }> {
    const [laborLines, travelOdcs] = await Promise.all([
      LaborLineItemService.getByAuthorization(itemId),
      TravelOdcService.getByAuthorization(itemId)
    ]);

    const baseLaborAmount = (laborLines ?? [])
      .filter((line) => line.isActive !== false && line.lineScope !== "mod")
      .reduce((total, line) => total + Number(line.totalAmount ?? 0), 0);
    const baseTravelAmount = (travelOdcs ?? [])
      .filter((line) => line.isActive !== false && line.lineScope !== "mod")
      .reduce((total, line) => total + Number(line.amount ?? 0), 0);
    const baseGrandTotal = baseLaborAmount + baseTravelAmount;

    const amounts = {
      baseLaborAmount,
      baseTravelAmount,
      baseGrandTotal
    };

    await this.updateBaseAmounts(itemId, amounts);

    return amounts;
  }

  static async updateApprovedAmounts(
    itemId: number,
    amounts: {
      approvedLaborAmount: number;
      approvedTravelAmount: number;
      approvedGrandTotal: number;
    }
  ): Promise<void> {

    if (!itemId) {
      throw new Error("Cannot update authorization approved totals: item.Id is missing.");
    }

    try {
      await Web().Lists(Strings.Sites.main.lists.Authorizations).Items().getById(itemId).update({
        __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Authorizations)}ListItem` },
        approvedLaborAmount: amounts.approvedLaborAmount,
        approvedTravelAmount: amounts.approvedTravelAmount,
        approvedGrandTotal: amounts.approvedGrandTotal
      }).executeAndWait();

    } catch (error) {
      const err = formatError(error);
      console.error("Error updating IWA approved totals: ", error);
      throw new Error(`Error updating IWA approved totals: ${err}`);
    }
  }

  static async recalculateApprovedAmounts(itemId: number): Promise<{
    approvedLaborAmount: number;
    approvedTravelAmount: number;
    approvedGrandTotal: number;
  }> {
    const [mods, laborLines, travelOdcs] = await Promise.all([
      ModService.getByAuthorization(itemId),
      LaborLineItemService.getByAuthorization(itemId),
      TravelOdcService.getByAuthorization(itemId)
    ]);
    const approvedModIds = new Set((mods ?? [])
      .filter((mod) => mod.modStatus === "approved")
      .map((mod) => mod.Id));
    const isApprovedLine = (line: { isActive?: boolean; lineScope?: string; mod?: { Id?: number } }): boolean => {
      if (line.isActive === false) {
        return false;
      }

      return line.lineScope !== "mod" || (!!line.mod?.Id && approvedModIds.has(line.mod.Id));
    };
    const approvedLaborAmount = (laborLines ?? [])
      .filter(isApprovedLine)
      .reduce((total, line) => total + Number(line.totalAmount ?? 0), 0);
    const approvedTravelAmount = (travelOdcs ?? [])
      .filter(isApprovedLine)
      .reduce((total, line) => total + Number(line.amount ?? 0), 0);
    const approvedGrandTotal = approvedLaborAmount + approvedTravelAmount;
    const amounts = {
      approvedLaborAmount,
      approvedTravelAmount,
      approvedGrandTotal
    };

    await this.updateApprovedAmounts(itemId, amounts);

    return amounts;
  }

  static async recalculateAuthorizationAmounts(itemId: number): Promise<{
    baseLaborAmount: number;
    baseTravelAmount: number;
    baseGrandTotal: number;
    approvedLaborAmount: number;
    approvedTravelAmount: number;
    approvedGrandTotal: number;
  }> {
    const [mods, laborLines, travelOdcs] = await Promise.all([
      ModService.getByAuthorization(itemId),
      LaborLineItemService.getByAuthorization(itemId),
      TravelOdcService.getByAuthorization(itemId)
    ]);
    const approvedModIds = new Set((mods ?? [])
      .filter((mod) => mod.modStatus === "approved")
      .map((mod) => mod.Id));
    const activeLines = {
      labor: (laborLines ?? []).filter((line) => line.isActive !== false),
      travel: (travelOdcs ?? []).filter((line) => line.isActive !== false)
    };
    const baseLaborAmount = activeLines.labor
      .filter((line) => line.lineScope !== "mod")
      .reduce((total, line) => total + Number(line.totalAmount ?? 0), 0);
    const baseTravelAmount = activeLines.travel
      .filter((line) => line.lineScope !== "mod")
      .reduce((total, line) => total + Number(line.amount ?? 0), 0);
    const isApprovedLine = (line: { lineScope?: string; mod?: { Id?: number } }): boolean => {
      return line.lineScope !== "mod" || (!!line.mod?.Id && approvedModIds.has(line.mod.Id));
    };
    const approvedLaborAmount = activeLines.labor
      .filter(isApprovedLine)
      .reduce((total, line) => total + Number(line.totalAmount ?? 0), 0);
    const approvedTravelAmount = activeLines.travel
      .filter(isApprovedLine)
      .reduce((total, line) => total + Number(line.amount ?? 0), 0);
    const amounts = {
      baseLaborAmount,
      baseTravelAmount,
      baseGrandTotal: baseLaborAmount + baseTravelAmount,
      approvedLaborAmount,
      approvedTravelAmount,
      approvedGrandTotal: approvedLaborAmount + approvedTravelAmount
    };

    await Web().Lists(Strings.Sites.main.lists.Authorizations).Items().getById(itemId).update({
      __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Authorizations)}ListItem` },
      ...amounts
    }).executeAndWait();

    return amounts;
  }

  static async updateWorkflowStatus(
    itemId: number,
    authorizationStatus: AuthorizationStatus,
    effectiveApprovedRunId?: number,
    approvedAmounts?: {
      approvedLaborAmount: number;
      approvedTravelAmount: number;
      approvedGrandTotal: number;
    },
    options?: {
      iwaJamisProjectId?: string;
    }
  ): Promise<void> {

    if (!itemId) {
      throw new Error("Cannot update authorization workflow status: item.Id is missing.");
    }

    const nowIso = new Date().toISOString();
    const updateBody: Record<string, unknown> = {
      __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Authorizations)}ListItem` },
      authorizationStatus
    };

    if (authorizationStatus === "approved") {
      updateBody.approvedOn = nowIso;
      updateBody.rejectedOn = null;

      if (approvedAmounts) {
        updateBody.approvedLaborAmount = approvedAmounts.approvedLaborAmount;
        updateBody.approvedTravelAmount = approvedAmounts.approvedTravelAmount;
        updateBody.approvedGrandTotal = approvedAmounts.approvedGrandTotal;
      }

      if (options?.iwaJamisProjectId !== undefined) {
        updateBody.iwaJamisProjectId = options.iwaJamisProjectId;
      }
    }

    if (authorizationStatus === "rejected") {
      updateBody.rejectedOn = nowIso;
    }

    if (effectiveApprovedRunId !== undefined) {
      updateBody.effectiveApprovedRunId = effectiveApprovedRunId;
    }

    try {
      await Web().Lists(Strings.Sites.main.lists.Authorizations).Items().getById(itemId).update(updateBody).executeAndWait();
    } catch (error) {
      const err = formatError(error);
      console.error("Error updating IWA workflow status: ", error);
      throw new Error(`Error updating IWA workflow status: ${err}`);
    }
  }

  // Only used for draft (when creating new > then click cancel)
  static delete(itemId: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      Web().Lists(Strings.Sites.main.lists.Authorizations).Items(itemId).recycle().execute(
        //success
        () => {
          console.info(`Deleted IWA ${itemId} !`)
          resolve();
        },
        //error
        (error) => {
          const err = formatError(error);
          console.error(`Error deleting IWA: ${err}`);
          reject(error);
        }
      )
    })
  }

}
