import { Web } from "gd-sprest";
import { IResourceItem } from "../data/props";
import Strings from "../common/strings";
import { formatError } from "../common/utils";

export class ResourceService {

    private static readonly selectQuery: string[] = [
        "Id", "Title", "lineScope",
        "lineNumber", "displayOrder", "isActive",
        "state", "comments", "authorization/Id",
        "authorization/Title", "mod/Id", "mod/Title",
        "employee/Id", "employee/Title", "employee/EMail"
    ];

    private static readonly expandQuery: string[] = ["authorization", "mod", "employee"];

    static getByAuthorization(authorizationId: number): Promise<IResourceItem[]> {
        return new Promise<IResourceItem[]>((resolve, reject) => {
            Web().Lists(Strings.Sites.main.lists.Resources).Items().query({
                Select: this.selectQuery,
                Expand: this.expandQuery,
                Filter: `authorization/Id eq ${authorizationId}`,
                OrderBy: ["displayOrder asc", "Id asc"],
                Top: 5000
            }).execute(
                (items) => resolve((items?.results ?? []) as unknown as IResourceItem[]),
                (error) => reject(new Error(`Error fetching Resources by Authorization: ${formatError(error)}`))
            );
        });
    }
}
