import { Web } from "gd-sprest";
import Strings from "../common/strings";
import { IAppUserItem, IPeoplePicker } from "../data/props";
import { encodeListName, formatError } from "../common/utils";
import { ContextInfo } from "gd-sprest";
import { DataSource } from "../data/ds";

export class AppUserService {

    static readonly visitSessionKey = "iwa_visit_counted";

    static createNewUserOnFirstVisit(): Promise<IAppUserItem> {
        const now = new Date().toISOString();
        return new Promise<IAppUserItem>((resolve, reject) => {
            Web().Lists(Strings.Sites.main.lists.Users).Items().add({
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Users)}ListItem` },
                userId: ContextInfo.userId,
                lastVisit: now,
                visitCount: 1
            }).execute(
                (item) => resolve(item as unknown as IAppUserItem),
                (error) => reject(new Error(`Error creating user row: ${formatError(error)}`))
            );
        })
    }

    static createNewUserInAdminPanel(personId: number, role: IAppUserItem["role"], modePreference: IAppUserItem["modePreference"]): Promise<IAppUserItem> {
        return new Promise<IAppUserItem>((resolve, reject) => {
            Web().Lists(Strings.Sites.main.lists.Users).Items().add({
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Users)}ListItem` },
                userId: personId,
                modePreference,
                role
            }).execute(
                (item) => resolve(item as unknown as IAppUserItem),
                (error) => reject(new Error(`Error creating user row: ${formatError(error)}`))
            );
        });
    }

    // Update lastVisit always; increment count only once per browser session
    static async touchCurrentUser(userItemId: number, currentVisitCount: number): Promise<void> {
        const now = new Date().toISOString();

        const counted = sessionStorage.getItem(this.visitSessionKey) === "1";
        const shouldIncrement = !counted;

        const updatePayload: Record<string, unknown> = {
            __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Users)}ListItem` },
            lastVisit: now
        };

        if (shouldIncrement) {
            updatePayload.visitCount = currentVisitCount + 1;
        }

        await new Promise<void>((resolve, reject) => {
            Web().Lists(Strings.Sites.main.lists.Users).Items().getById(userItemId)
                .update(updatePayload)
                .execute(
                    () => {
                        if (shouldIncrement) sessionStorage.setItem(this.visitSessionKey, "1");
                        resolve();
                    },
                    (error) => reject(new Error(`Error updating lastVisit/visitCount: ${formatError(error)}`))
                );
        });
    }

    static async updateMyModePreference(mode: "dark" | "light"): Promise<void> {

        if (!DataSource.CurrentUser?.Id) throw new Error("Current user is not available");

        await Web().Lists(Strings.Sites.main.lists.Users).Items().getById(DataSource.CurrentUser.Id).update({
            __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Users)}ListItem` },
            modePreference: mode
        }).executeAndWait();

        //keep local cache consistent
        await DataSource.getOrCreateCurrentUser();
    }

    // Update the role for an existing App User list item
    static async updateRole(appUserItemId: number, role: IAppUserItem["role"]): Promise<void> {
        try {
            await Web().Lists(Strings.Sites.main.lists.Users).Items().getById(appUserItemId).update({
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Users)}ListItem` },
                role
            }).executeAndWait();
        } catch (err) {
            throw new Error(`Error updating user role: ${formatError(err)}`);
        }
    }

    static async updateBackups(appUserItemId: number, backups: { results?: IPeoplePicker[]; }): Promise<void> {
        const selectedBackups = backups.results ?? [];
        const hasBackup = selectedBackups.length > 0;

        try {
            await Web().Lists(Strings.Sites.main.lists.Users).Items().getById(appUserItemId).update({
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Users)}ListItem` },
                backupsId: { results: selectedBackups.map((backup: IPeoplePicker): number => backup.Id) },
                hasBackup
            }).executeAndWait();
        } catch (err) {
            throw new Error(`Error updating user backups: ${formatError(err)}`);
        }
    }

}
