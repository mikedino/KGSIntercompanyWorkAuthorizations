import { Web } from "gd-sprest";
import { ITravelOdcItem } from "../data/props";
import Strings from "../common/strings";
import { encodeListName, formatError } from "../common/utils";

export class TravelOdcService {

    private static readonly selectQuery: string[] = [
        "Id", "Title", "lineScope",
        "lineNumber", "displayOrder", "isActive",
        "lineType", "jobId", "description",
        "amount", "comments", "authorization/Id",
        "authorization/Title", "mod/Id", "mod/Title"
    ];

    private static readonly expandQuery: string[] = ["authorization", "mod"];

    static async replaceForAuthorization(
        authorizationId: number,
        rows: Array<{
            title: string;
            lineNumber: number;
            displayOrder: number;
            lineType: "travel" | "odc" | "other";
            jobId: string;
            description?: string;
            amount: number;
            comments?: string;
        }>
    ): Promise<ITravelOdcItem[]> {
        const existing = await this.getByAuthorization(authorizationId);

        for (const item of existing) {
            await Web().Lists(Strings.Sites.main.lists.TravelODC).Items(item.Id).recycle().executeAndWait();
        }

        for (const row of rows) {
            await Web().Lists(Strings.Sites.main.lists.TravelODC).Items().add({
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.TravelODC)}ListItem` },
                Title: row.title,
                authorizationId,
                lineScope: "base",
                lineNumber: row.lineNumber,
                displayOrder: row.displayOrder,
                isActive: true,
                lineType: row.lineType,
                jobId: row.jobId,
                description: row.description ?? "",
                amount: row.amount,
                comments: row.comments ?? ""
            }).executeAndWait();
        }

        return this.getByAuthorization(authorizationId);
    }

    static getByAuthorization(authorizationId: number): Promise<ITravelOdcItem[]> {
        return new Promise<ITravelOdcItem[]>((resolve, reject) => {
            Web().Lists(Strings.Sites.main.lists.TravelODC).Items().query({
                Select: this.selectQuery,
                Expand: this.expandQuery,
                Filter: `authorization/Id eq ${authorizationId}`,
                OrderBy: ["displayOrder asc", "Id asc"],
                Top: 5000
            }).execute(
                (items) => resolve((items?.results ?? []) as unknown as ITravelOdcItem[]),
                (error) => reject(new Error(`Error fetching Travel/ODC by Authorization: ${formatError(error)}`))
            );
        });
    }
}
