import { Web } from "gd-sprest";
import Strings from "../common/strings";
import { encodeListName, formatError } from "../common/utils";


export class EntityService {

    static create(Title: string, abbr: string, GMId?: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {

            Web(Strings.Sites.lookups.url)
                .Lists(Strings.Sites.lookups.lists.Entities)
                .Items()
                .add({
                    __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.lookups.lists.Entities)}ListItem` },
                    Title,
                    abbr,
                    GMId
                })
                .execute(
                    () => resolve(),
                    (err) => reject(new Error(`Error creating Entity: ${formatError(err)}`))
                );
        });
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

        return new Promise<void>((resolve, reject) => {
            Web(Strings.Sites.lookups.url)
                .Lists(Strings.Sites.lookups.lists.Entities)
                .Items()
                .getById(entityId)
                .update(payload)
                .execute(
                    () => resolve(),
                    (err) => reject(new Error(`Error updating Entity: ${formatError(err)}`))
                );
        });
    }

    static updateGm(entityId: number, gmId?: number): Promise<void> {
        return this.update(entityId, undefined, undefined, gmId ?? undefined);
    }

    static updateTitle(entityId: number, abbr: string, title: string): Promise<void> {
        return this.update(entityId, abbr, title);
    }

    static delete(entityId: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Web(Strings.Sites.lookups.url)
                .Lists(Strings.Sites.lookups.lists.Entities)
                .Items()
                .getById(entityId)
                .recycle()
                .execute(
                    () => resolve(),
                    (err) => reject(new Error(`Error deleting Entity: ${formatError(err)}`))
                );
        });
    }

}