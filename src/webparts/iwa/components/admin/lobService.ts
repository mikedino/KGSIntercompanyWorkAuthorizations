import { Web } from "gd-sprest";
import Strings from "../common/strings";
import { encodeListName, formatError } from "../common/utils";

export class LobService {

    static create(Title: string, cooId?: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {

            Web(Strings.Sites.lookups.url)
                .Lists(Strings.Sites.lookups.lists.LOBs)
                .Items()
                .add({
                    __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.lookups.lists.LOBs)}ListItem` },
                    Title,
                    cooId
                })
                .execute(
                    () => resolve(),
                    (err) => reject(new Error(`Error creating LOB: ${formatError(err)}`))
                );
        });
    }

    static update(lobId: number, title?: string, cooId?: number | undefined): Promise<void> {
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

        return new Promise<void>((resolve, reject) => {
            Web(Strings.Sites.lookups.url)
                .Lists(Strings.Sites.lookups.lists.LOBs)
                .Items()
                .getById(lobId)
                .update(payload)
                .execute(
                    () => resolve(),
                    (err) => reject(new Error(`Error updating LOB: ${formatError(err)}`))
                );
        });
    }

    static updateCoo(lobId: number, cooId?: number): Promise<void> {
        return this.update(lobId, undefined, cooId ?? undefined);
    }

    static updateTitle(lobId: number, title: string): Promise<void> {
        return this.update(lobId, title);
    }

    static delete(lobId: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Web(Strings.Sites.lookups.url)
                .Lists(Strings.Sites.lookups.lists.LOBs)
                .Items()
                .getById(lobId)
                .recycle()
                .execute(
                    () => resolve(),
                    (err) => reject(new Error(`Error deleting LOB: ${formatError(err)}`))
                );
        });
    }
}