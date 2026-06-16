import { Web } from "gd-sprest";
import { IPeoplePicker } from "../data/props";

type EnsureUserResult = {
    Id?: number;
    LoginName?: string;
    Title?: string;
    Email?: string;
    EMail?: string;
};

const getPersonLogin = (person?: Partial<IPeoplePicker>): string | undefined => {
    const extended = person as (Partial<IPeoplePicker> & { LoginName?: string; loginName?: string; Key?: string; key?: string }) | undefined;
    return extended?.LoginName ?? extended?.loginName ?? extended?.Key ?? extended?.key;
};

export class SharePointUserResolver {
    private static readonly userIdCache = new Map<string, number>();

    private static getCacheKey(value: string): string {
        return value.trim().toLowerCase();
    }

    private static getEnsureCandidates(person: Partial<IPeoplePicker>, fallbackEmail?: string): string[] {
        const email = (person.EMail ?? person.secondaryText ?? fallbackEmail ?? "").trim();
        const rawLogin = (getPersonLogin(person) ?? "").trim();
        const login = rawLogin && !/^\d+$/.test(rawLogin) ? rawLogin : "";

        return [
            login,
            email,
            email ? `i:0#.f|membership|${email.toLowerCase()}` : ""
        ].filter((candidate, index, all) => !!candidate && all.indexOf(candidate) === index);
    }

    static async resolvePersonIdForCurrentWeb(
        person?: Partial<IPeoplePicker>,
        fallbackId?: number,
        contextLabel: string = "SharePoint person field"
    ): Promise<number | undefined> {
        if (!person) {
            return fallbackId ?? undefined;
        }

        const email = (person.EMail ?? person.secondaryText ?? "").trim();
        const cacheKey = email ? this.getCacheKey(email) : undefined;

        if (cacheKey && this.userIdCache.has(cacheKey)) {
            return this.userIdCache.get(cacheKey);
        }

        // SharePoint person fields do not store a tenant-wide user key. They store
        // the numeric row Id from the target site's hidden User Information List.
        // The same employee can be #273 in the config site collection and #36 in
        // the production app site collection. Any person copied from another web
        // must be ensured against Web() before we write FieldNameId here.
        for (const candidate of this.getEnsureCandidates(person, email)) {
            try {
                const ensured = await Web().ensureUser(candidate).executeAndWait() as EnsureUserResult;

                if (ensured?.Id) {
                    if (cacheKey) {
                        this.userIdCache.set(cacheKey, ensured.Id);
                    }

                    return ensured.Id;
                }
            } catch (error) {
                console.warn(`Unable to ensure ${contextLabel} with key '${candidate}'.`, error);
            }
        }

        if (email) {
            try {
                const siteUser = await Web().SiteUsers().getByEmail(email).executeAndWait() as EnsureUserResult;

                if (siteUser?.Id) {
                    if (cacheKey) {
                        this.userIdCache.set(cacheKey, siteUser.Id);
                    }

                    return siteUser.Id;
                }
            } catch (error) {
                console.warn(`Unable to resolve ${contextLabel} by email '${email}'.`, error);
            }
        }

        // Last resort: keep the existing Id only when we have no portable identity
        // (email/login) to resolve. This preserves manually selected values from
        // the current web, but avoids pretending cross-site numeric IDs are safe.
        return fallbackId ?? person.Id;
    }
}
