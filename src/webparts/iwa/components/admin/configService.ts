import { Web } from "gd-sprest";
import Strings from "../common/strings";
import { encodeListName, formatError } from "../common/utils";
import { DataSource } from "../data/ds";

export class ConfigService {

    static updateApprover(configItemId: number, userId?: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Web(Strings.Sites.lookups.url)
                .Lists(Strings.Sites.lookups.lists.Config)
                .Items()
                .getById(configItemId)
                .update({
                    __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.lookups.lists.Config)}ListItem` },
                    UserId: userId ?? null
                })
                .execute(
                    () => resolve(),
                    (err) => reject(new Error(`Error updating Config list approver: ${formatError(err)}`))
                );
        });
    }

    // update config approvers real-time
    static async updateConfigApprover(configItemId: number, userId?: number): Promise<void> {
        await this.updateApprover(configItemId, userId);
        await DataSource.getConfig();
    }

}