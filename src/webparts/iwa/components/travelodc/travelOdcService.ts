import { Web } from "gd-sprest";
import { ITravelOdcItem } from "../data/props";
import Strings from "../common/strings";
import { formatError } from "../common/utils";

export class TravelOdcService {

    private static readonly selectQuery: string[] = [
        "Id", "Title", "lineScope",
        "lineNumber", "displayOrder", "isActive",
        "lineType", "jobId", "description",
        "amount", "comments", "authorization/Id",
        "authorization/Title", "mod/Id", "mod/Title"
    ];

    private static readonly expandQuery: string[] = ["authorization", "mod"];

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
