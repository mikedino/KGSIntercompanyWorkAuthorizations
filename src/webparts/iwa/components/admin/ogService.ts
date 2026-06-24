import Strings from "../common/strings";
import { encodeListName } from "../common/utils";
import { IOgItem } from "../data/props";
import { AdminLookupWriteService } from "./adminLookupWriteService";

export interface IOgPayload {
    Id: number;
    Title: string;
    presidentId: number;
    lobId: number;
    ogType: IOgItem["ogType"];
    parentOgId?: number;
    isActive: boolean;
    isSelectable: boolean;
    CMId?: number;
    SCMId?: number;
}

export class OgService {

    static async create(item: IOgPayload): Promise<void> {
        await AdminLookupWriteService.addItem(
            Strings.Sites.lookups.lists.OGs,
            {
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.lookups.lists.OGs)}ListItem` },
                Title: item.Title,
                presidentId: item.presidentId,
                lobId: item.lobId,
                CMId: item.CMId,
                SCMId: item.SCMId,
                ogType: item.ogType,
                parentOgId: item.parentOgId,
                isActive: item.isActive,
                isSelectable: item.isSelectable
            }
        );
    }

    static async updateApprovers(ogId: number, presidentId?: number, cmId?: number): Promise<void> {
        await AdminLookupWriteService.updateItem(
            Strings.Sites.lookups.lists.OGs,
            ogId,
            {
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.lookups.lists.OGs)}ListItem` },
                presidentId: presidentId ?? null,
                CMId: cmId ?? null
            }
        );
    }

    static async update(item: IOgPayload): Promise<void> {
        await AdminLookupWriteService.updateItem(
            Strings.Sites.lookups.lists.OGs,
            item.Id,
            {
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.lookups.lists.OGs)}ListItem` },
                Title: item.Title,
                presidentId: item.presidentId,
                lobId: item.lobId,
                CMId: item.CMId,
                SCMId: item.SCMId,
                ogType: item.ogType,
                parentOgId: item.parentOgId,
                isActive: item.isActive,
                isSelectable: item.isSelectable
            }
        );
    }

    static async delete(ogId: number): Promise<void> {
        await AdminLookupWriteService.recycleItem(Strings.Sites.lookups.lists.OGs, ogId);
    }

}
