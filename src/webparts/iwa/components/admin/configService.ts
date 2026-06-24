import Strings from "../common/strings";
import { encodeListName } from "../common/utils";
import { DataSource } from "../data/ds";
import { AdminLookupWriteService } from "./adminLookupWriteService";

export class ConfigService {

    static async updateApprover(configItemId: number, userId?: number): Promise<void> {
        await AdminLookupWriteService.updateItem(
            Strings.Sites.lookups.lists.Config,
            configItemId,
            {
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.lookups.lists.Config)}ListItem` },
                UserId: userId ?? null
            }
        );
    }

    // update config approvers real-time
    static async updateConfigApprover(configItemId: number, userId?: number): Promise<void> {
        await this.updateApprover(configItemId, userId);
        await DataSource.getConfig();
    }

}
