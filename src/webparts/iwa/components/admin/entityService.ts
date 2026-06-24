import Strings from "../common/strings";
import { encodeListName } from "../common/utils";
import { AdminLookupWriteService } from "./adminLookupWriteService";


export class EntityService {

    static async create(Title: string, abbr: string, GMId?: number): Promise<void> {
        await AdminLookupWriteService.addItem(
            Strings.Sites.lookups.lists.Entities,
            {
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.lookups.lists.Entities)}ListItem` },
                Title,
                abbr,
                GMId
            }
        );
    }

    // Update the role for an existing App User list item
    static async update(entityId: number, abbrev?: string, title?: string, gmId?: number): Promise<void> {

        const payload: {
            __metadata: { type: string };
            Title?: string;
            abbr?: string;
            GMId?: number | undefined;
        } = {
            __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.lookups.lists.Entities)}ListItem` }
        };

        if (typeof title === "string") {
            payload.Title = title;
        }

        if (typeof abbrev === "string") {
            payload.abbr = abbrev;
        }

        if (typeof gmId !== "undefined") {
            payload.GMId = gmId;
        }

        await AdminLookupWriteService.updateItem(Strings.Sites.lookups.lists.Entities, entityId, payload);
    }

    static updateGm(entityId: number, gmId?: number): Promise<void> {
        return this.update(entityId, undefined, undefined, gmId ?? undefined);
    }

    static updateTitle(entityId: number, abbr: string, title: string): Promise<void> {
        return this.update(entityId, abbr, title);
    }

    static async delete(entityId: number): Promise<void> {
        await AdminLookupWriteService.recycleItem(Strings.Sites.lookups.lists.Entities, entityId);
    }

}
