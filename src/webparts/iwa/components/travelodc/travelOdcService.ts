import { Web } from "gd-sprest";
import { ITravelOdcItem, LineScope } from "../data/props";
import Strings from "../common/strings";
import { encodeListName, formatError } from "../common/utils";

export class TravelOdcService {

    private static readonly selectQuery: string[] = [
        "Id", "Title", "lineScope",
        "lineNumber", "displayOrder", "isActive",
        "lineType", "jobId", "jobTitle", "description",
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
            jobTitle?: string;
            description?: string;
            amount: number;
            comments?: string;
        }>,
        options?: {
            lineScope?: LineScope;
            modId?: number;
        }
    ): Promise<ITravelOdcItem[]> {
        const lineScope = options?.lineScope ?? "base";
        if (lineScope === "mod" && !options?.modId) {
            throw new Error("Cannot save mod travel/ODC lines without a Mod lookup.");
        }

        const existing = await this.getByAuthorization(authorizationId);

        for (const item of existing) {
            const matchesScope = item.lineScope === lineScope;
            // Only replace rows that belong to the same data lane. Mod saves must
            // never sweep up orphaned mod-scope rows, because that masks a missing
            // Mod lookup and can make an in-flight modification appear to vanish.
            const matchesMod = lineScope === "base"
                ? !item.mod?.Id
                : item.mod?.Id === options?.modId;

            if (matchesScope && matchesMod) {
                await Web().Lists(Strings.Sites.main.lists.TravelODC).Items(item.Id).recycle().executeAndWait();
            }
        }

        for (const row of rows) {
            const addBody: Record<string, unknown> = {
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.TravelODC)}ListItem` },
                Title: row.title,
                authorizationId,
                lineScope,
                lineNumber: row.lineNumber,
                displayOrder: row.displayOrder,
                isActive: true,
                lineType: row.lineType,
                jobId: row.jobId,
                jobTitle: row.jobTitle ?? "",
                description: row.description ?? "",
                amount: row.amount,
                comments: row.comments ?? ""
            };

            if (options?.modId) {
                addBody.modId = options.modId;
            }

            await Web().Lists(Strings.Sites.main.lists.TravelODC).Items().add(addBody).executeAndWait();
        }

        const saved = await this.getByAuthorization(authorizationId);
        return saved.filter((item) => item.lineScope === lineScope && (lineScope === "base" || item.mod?.Id === options?.modId));
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

    static async deleteForMod(authorizationId: number, modId: number): Promise<void> {
        if (!authorizationId || !modId) {
            return;
        }

        const existing = await this.getByAuthorization(authorizationId);

        for (const item of existing) {
            if (item.lineScope === "mod" && item.mod?.Id === modId) {
                await Web().Lists(Strings.Sites.main.lists.TravelODC).Items(item.Id).recycle().executeAndWait();
            }
        }
    }
}
