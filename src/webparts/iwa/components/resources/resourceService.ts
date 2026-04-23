import { Web } from "gd-sprest";
import { IResourceItem } from "../data/props";
import Strings from "../common/strings";
import { encodeListName, formatError } from "../common/utils";

export class ResourceService {

    private static readonly selectQuery: string[] = [
        "Id", "Title", "lineScope",
        "lineNumber", "displayOrder", "isActive",
        "state", "comments", "authorization/Id",
        "authorization/Title", "mod/Id", "mod/Title",
        "employee/Id", "employee/Title", "employee/EMail"
    ];

    private static readonly expandQuery: string[] = ["authorization", "mod", "employee"];

    static async replaceForAuthorization(
        authorizationId: number,
        rows: Array<{
            title: string;
            lineNumber: number;
            displayOrder: number;
            employeeId: number;
            state: string;
            comments?: string;
        }>
    ): Promise<IResourceItem[]> {
        const existing = await this.getByAuthorization(authorizationId);

        for (const item of existing) {
            await Web().Lists(Strings.Sites.main.lists.Resources).Items(item.Id).recycle().executeAndWait();
        }

        for (const row of rows) {
            await Web().Lists(Strings.Sites.main.lists.Resources).Items().add({
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Resources)}ListItem` },
                Title: row.title,
                authorizationId,
                lineScope: "base",
                lineNumber: row.lineNumber,
                displayOrder: row.displayOrder,
                isActive: true,
                employeeId: row.employeeId,
                state: row.state,
                comments: row.comments ?? ""
            }).executeAndWait();
        }

        return this.getByAuthorization(authorizationId);
    }

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
