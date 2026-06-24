import Strings from "../common/strings";
import { encodeListName } from "../common/utils";
import { AdminLookupWriteService } from "./adminLookupWriteService";

export class LobService {

    static async create(Title: string, cooId?: number): Promise<void> {
        await AdminLookupWriteService.addItem(
            Strings.Sites.lookups.lists.LOBs,
            {
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.lookups.lists.LOBs)}ListItem` },
                Title,
                cooId
            }
        );
    }

    static async update(lobId: number, title?: string, cooId?: number | undefined): Promise<void> {
        const payload: {
            __metadata: { type: string };
            Title?: string;
            cooId?: number | undefined;
        } = {
            __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.lookups.lists.LOBs)}ListItem` }
        };

        if (typeof title === "string") {
            payload.Title = title;
        }

        if (typeof cooId !== "undefined") {
            payload.cooId = cooId;
        }

        await AdminLookupWriteService.updateItem(Strings.Sites.lookups.lists.LOBs, lobId, payload);
    }

    static updateCoo(lobId: number, cooId?: number): Promise<void> {
        return this.update(lobId, undefined, cooId ?? undefined);
    }

    static updateTitle(lobId: number, title: string): Promise<void> {
        return this.update(lobId, title);
    }

    static async delete(lobId: number): Promise<void> {
        await AdminLookupWriteService.recycleItem(Strings.Sites.lookups.lists.LOBs, lobId);
    }
}
