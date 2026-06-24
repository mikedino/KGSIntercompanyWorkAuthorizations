import { ContextInfo, Web } from "gd-sprest";
import { WebPartContext } from "@microsoft/sp-webpart-base";
import Strings from "../common/strings";

type ContextInfoResult = {
    GetContextWebInformation?: {
        FormDigestValue?: string;
    };
};

type ContextInfoWithGetWeb = typeof ContextInfo & {
    getWeb: (url: string) => {
        executeAndWait: () => Promise<ContextInfoResult>;
    };
};

export class AdminLookupWriteService {
    private static context: WebPartContext | undefined;
    private static requestDigest: string | undefined;

    static configure(context: WebPartContext): void {
        this.context = context;
    }

    static get lookupsAbsoluteUrl(): string {
        const sourceUrl = this.context?.pageContext.web.absoluteUrl ?? window.location.origin;
        return new URL(Strings.Sites.lookups.url, sourceUrl).toString().replace(/\/$/, "");
    }

    private static async getRequestDigest(): Promise<string> {
        if (this.requestDigest) {
            return this.requestDigest;
        }

        const contextInfo = await (ContextInfo as ContextInfoWithGetWeb)
            .getWeb(this.lookupsAbsoluteUrl)
            .executeAndWait();
        const digest = contextInfo.GetContextWebInformation?.FormDigestValue;

        if (!digest) {
            throw new Error("Unable to load request digest for the lookup site.");
        }

        this.requestDigest = digest;
        return digest;
    }

    static async addItem<TResponse = unknown>(listName: string, payload: Record<string, unknown>): Promise<TResponse | undefined> {
        return await Web(this.lookupsAbsoluteUrl, { requestDigest: await this.getRequestDigest() })
            .Lists(listName)
            .Items()
            .add(payload)
            .executeAndWait() as TResponse;
    }

    static async updateItem(listName: string, itemId: number, payload: Record<string, unknown>): Promise<void> {
        await Web(this.lookupsAbsoluteUrl, { requestDigest: await this.getRequestDigest() })
            .Lists(listName)
            .Items()
            .getById(itemId)
            .update(payload)
            .executeAndWait();
    }

    static async recycleItem(listName: string, itemId: number): Promise<void> {
        await Web(this.lookupsAbsoluteUrl, { requestDigest: await this.getRequestDigest() })
            .Lists(listName)
            .Items()
            .getById(itemId)
            .recycle()
            .executeAndWait();
    }
}
