import { AuthorizationStatus, ICounterItem, IAuthorizationItem } from "../data/props";
import { Web } from "gd-sprest";
import Strings from "../common/strings";
import { formatError, encodeListName } from "../common/utils";
import dayjs from 'dayjs';
import { DataSource } from "../data/ds";
import { Base } from "gd-sprest/@types/intellisense";
import { LaborLineItemService } from "../laborlineitems/laborLineItemService";
import { TravelOdcService } from "../travelodc/travelOdcService";

type IExecWithHeaders<T> = Base.IBaseExecution<T> & {
  headers?: { [key: string]: string };
};

export class AuthorizationService {

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

    return new Promise<IAuthorizationItem>((resolve, reject) => {

      // Keep the update payload tightly aligned to the provisioned
      // authorization header fields so draft/save/submit all share one path.
      const updateBody: Record<string, unknown> = {
        __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Authorizations)}ListItem` },
        authorizationStatus,
        backupRequestorId: item.backupRequestor?.Id ?? null,
        pmId: item.pm?.Id ?? null,
        donorEntity: item.donorEntity,
        donorEntityAbbr: item.donorEntityAbbr ?? "",
        donorGmId: item.donorGm?.Id ?? null,
        receivingEntity: item.receivingEntity,
        receivingEntityAbbr: item.receivingEntityAbbr ?? "",
        receivingGmId: item.receivingGm?.Id ?? null,
        og: item.og ?? "",
        lob: item.lob ?? "",
        contractName: item.contractName,
        contractId: item.contractId,
        invoice: item.invoice ?? "",
        contractType: item.contractType,
        periodStart: item.periodStart || null,
        periodEnd: item.periodEnd || null,
        scopeOfWork: item.scopeOfWork ?? "",
        justification: item.justification ?? "",
        notes: item.notes ?? "",
        baseLaborAmount: item.baseLaborAmount ?? 0,
        baseTravelAmount: item.baseTravelAmount ?? 0,
        baseGrandTotal: item.baseGrandTotal ?? 0,
        approvedLaborAmount: item.approvedLaborAmount ?? 0,
        approvedTravelAmount: item.approvedTravelAmount ?? 0,
        approvedGrandTotal: item.approvedGrandTotal ?? 0,
        modCount: item.modCount ?? 0,
        pdfUrl: item.pdfUrl ?? "",
        pdfGeneratedOn: item.pdfGeneratedOn || null,
        approvedOn: item.approvedOn || null,
        rejectedOn: item.rejectedOn || null,
        canceledOn: item.canceledOn || null,
        closedOn: item.closedOn || null
      };

      if (trackingTitle) {
        updateBody.Title = trackingTitle;
      }

      if (item.currentWorkflowRun?.Id) {
        updateBody.currentWorkflowRunId = item.currentWorkflowRun.Id;
      }

      if (item.effectiveApprovedRun?.Id) {
        updateBody.effectiveApprovedRunId = item.effectiveApprovedRun.Id;
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

    const baseLaborAmount = (laborLines ?? []).reduce((total, line) => total + Number(line.totalAmount ?? 0), 0);
    const baseTravelAmount = (travelOdcs ?? []).reduce((total, line) => total + Number(line.amount ?? 0), 0);
    const baseGrandTotal = baseLaborAmount + baseTravelAmount;

    const amounts = {
      baseLaborAmount,
      baseTravelAmount,
      baseGrandTotal
    };

    await this.updateBaseAmounts(itemId, amounts);

    return amounts;
  }

  static async updateWorkflowStatus(
    itemId: number,
    authorizationStatus: AuthorizationStatus,
    effectiveApprovedRunId?: number
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
