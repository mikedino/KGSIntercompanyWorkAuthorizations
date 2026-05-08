import { ContextInfo, Web } from "gd-sprest";
import Strings from "../../common/strings";
import { encodeListName } from "../../common/utils";
import { IInvoiceItem } from "../../data/props";
import { formatExportModLabel, IIwaExportViewModel } from "./exportViewModel";

export interface ISavedIwaExportPdf {
    fileName: string;
    pdfUrl: string;
    generatedOn: string;
}

const getListEntityTypeName = async (listName: string): Promise<string> => {
    const list = await Web(Strings.Sites.main.url)
        .Lists(listName)
        .query({ Select: ["ListItemEntityTypeFullName"] })
        .executeAndWait() as { ListItemEntityTypeFullName?: string };

    return list.ListItemEntityTypeFullName ?? `SP.Data.${encodeListName(listName)}ListItem`;
};

const sanitizeFileNamePart = (value: string): string => {
    return value
        .replace(/[~"#%&*:<>?/\\{|}]+/g, "-")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
};

const getExportFileName = (model: IIwaExportViewModel): string => {
    const exportLabel = model.mod ? formatExportModLabel(model.mod.modNumber) : "BASE";

    return `${sanitizeFileNamePart(model.authorization.Title)}-${exportLabel}.pdf`;
};

const toAbsoluteUrl = (serverRelativeUrl: string): string => {
    return new URL(serverRelativeUrl, ContextInfo.webAbsoluteUrl).toString();
};

export class IwaExportService {
    static async saveApprovedPdf(
        model: IIwaExportViewModel,
        taskOrder: IInvoiceItem | undefined,
        pdfContent: ArrayBuffer,
        generatedOn: string
    ): Promise<ISavedIwaExportPdf> {
        if (model.option.pdfUrl) {
            return {
                fileName: model.option.pdfUrl.split("/").pop() ?? "IWA Export.pdf",
                pdfUrl: model.option.pdfUrl,
                generatedOn: model.option.pdfGeneratedOn ?? generatedOn
            };
        }

        const fileName = getExportFileName(model);
        const [exportsEntityType, exportsRoot] = await Promise.all([
            getListEntityTypeName(Strings.Sites.main.lists.Exports),
            Web(Strings.Sites.main.url)
                .Lists(Strings.Sites.main.lists.Exports)
                .RootFolder()
                .query({ Select: ["ServerRelativeUrl"] })
                .executeAndWait()
        ]);
        const rootUrl = exportsRoot.ServerRelativeUrl;

        if (!rootUrl) {
            throw new Error("Cannot save PDF: IWAExports library root URL was not found.");
        }

        const fileServerRelativeUrl = `${rootUrl}/${fileName}`;

        await Web(Strings.Sites.main.url)
            .getFolderByServerRelativeUrl(rootUrl)
            .Files()
            .add(fileName, false, pdfContent)
            .executeAndWait();

        const exportLabel = model.mod ? formatExportModLabel(model.mod.modNumber) : "Base IWA";
        const workflowRunId = model.mod?.effectiveApprovedRun?.Id ?? model.authorization.effectiveApprovedRun?.Id;
        const exportItemBody: Record<string, unknown> = {
            __metadata: { type: exportsEntityType },
            Title: `${model.authorization.Title} ${exportLabel}`,
            authorizationId: model.authorization.Id,
            modId: model.mod?.Id ?? null,
            workflowRunId: workflowRunId ?? null,
            exportType: model.mod ? "mod" : "base",
            exportLabel,
            modNumber: model.mod?.modNumber ?? null,
            contractId: model.authorization.contractId ?? "",
            taskOrderNumber: taskOrder?.field_14 ?? model.authorization.invoice ?? "",
            donorEntity: model.authorization.donorEntity ?? "",
            receivingEntity: model.authorization.receivingEntity ?? "",
            laborAmount: model.modLaborTotal,
            travelAmount: model.modTravelTotal,
            thisTotal: model.modGrandTotal,
            previousTotal: model.previousGrandTotal,
            newTotal: model.newGrandTotal,
            approvedOn: model.approvedOn ?? null,
            generatedOn
        };

        const uploadedItem = await Web(Strings.Sites.main.url)
            .getFileByServerRelativeUrl(fileServerRelativeUrl)
            .ListItemAllFields()
            .query({ Select: ["Id"] })
            .executeAndWait();

        const uploadedItemId = Number(uploadedItem?.Id);

        if (!uploadedItemId) {
            throw new Error("Cannot save PDF metadata: uploaded export item id was not found.");
        }

        await Web(Strings.Sites.main.url)
            .Lists(Strings.Sites.main.lists.Exports)
            .Items()
            .getById(uploadedItemId)
            .update(exportItemBody)
            .executeAndWait();

        const pdfUrl = toAbsoluteUrl(fileServerRelativeUrl);
        const [targetEntityType, targetListName, targetId] = model.mod
            ? [await getListEntityTypeName(Strings.Sites.main.lists.Mods), Strings.Sites.main.lists.Mods, model.mod.Id]
            : [await getListEntityTypeName(Strings.Sites.main.lists.Authorizations), Strings.Sites.main.lists.Authorizations, model.authorization.Id];

        await Web(Strings.Sites.main.url)
            .Lists(targetListName)
            .Items()
            .getById(targetId)
            .update({
                __metadata: { type: targetEntityType },
                pdfUrl,
                pdfGeneratedOn: generatedOn
            })
            .executeAndWait();

        return {
            fileName,
            pdfUrl,
            generatedOn
        };
    }
}
