import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DataSource } from "./ds";
import { formatError } from "../common/utils";
import {
    IAuthorizationItem,
    IAppUserItem,
    IModItem,
    IWorkflowRunItem
} from "./props";

export type RefreshMode = "boot" | "refresh";

export interface IIwaDataState {
    authorizations: IAuthorizationItem[];
    draftAuthorizations: IAuthorizationItem[];
    draftModsByAuthorizationId: Map<number, IModItem>;
    runByAuthorizationId: Map<number, IWorkflowRunItem>;
    isBootLoading: boolean;
    isRefreshing: boolean;
    lastRefreshed: string | undefined;
    refresh: (override?: boolean, mode?: RefreshMode) => Promise<boolean>;
    fatalError?: string;
    appUser?: IAppUserItem;
}

export const useIwaData = (
    onError?: (title: string, message: string) => boolean,
    enabled = true
): IIwaDataState => {
    const [authorizations, setAuthorizations] = useState<IAuthorizationItem[]>([]);
    const [draftAuthorizations, setDraftAuthorizations] = useState<IAuthorizationItem[]>([]);
    const [draftModsByAuthorizationId, setDraftModsByAuthorizationId] = useState<Map<number, IModItem>>(new Map());
    const [runByAuthorizationId, setRunByAuthorizationId] = useState<Map<number, IWorkflowRunItem>>(new Map());

    const [isBootLoading, setIsBootLoading] = useState<boolean>(enabled);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [lastRefreshed, setLastRefreshed] = useState<string | undefined>(undefined);
    const [fatalError, setFatalError] = useState<string | undefined>(undefined);
    const [appUser, setAppUser] = useState<IAppUserItem | undefined>(undefined);

    const appUserRef = useRef<IAppUserItem | undefined>(undefined);

    useEffect((): undefined => {
        appUserRef.current = appUser;
        return undefined;
    }, [appUser]);

    const refresh = useCallback(async (
        override = false,
        mode: RefreshMode = "refresh"
    ): Promise<boolean> => {
        if (!enabled) {
            setIsBootLoading(false);
            setIsRefreshing(false);
            return false;
        }

        const isBootMode = mode === "boot";

        try {
            setFatalError(undefined);

            if (isBootMode) {
                setIsBootLoading(true);
            } else {
                setIsRefreshing(true);
            }

            // STEP 1: App user
            if (isBootMode || !appUserRef.current) {
                try {
                    const currentUser = await DataSource.getOrCreateCurrentUser();
                    setAppUser(currentUser);
                } catch (error) {
                    const message = `Error loading app user: ${formatError(error)}`;
                    console.error("Error loading app user", error);
                    setFatalError(message);
                    onError?.("App Initialization Error", message);
                    return false;
                }
            }

            // STEP 2: Initialize datasource
            try {
                await DataSource.init(override);
            } catch (error) {
                const message = `Error initializing datasource: ${formatError(error)}`;
                console.error("Error initializing datasource", error);
                setFatalError(message);
                onError?.("Initialization Error", message);
                return false;
            }

            // STEP 3: Authorizations
            try {
                const nextAuthorizations: IAuthorizationItem[] = [...(DataSource.Authorizations ?? [])];
                setAuthorizations(nextAuthorizations);
            } catch (error) {
                const message = `Error loading authorizations: ${formatError(error)}`;
                console.error("Error loading authorizations", error);
                setFatalError(message);
                onError?.("Data Load Error", message);
                return false;
            }

            // STEP 3B: Draft authorizations for resume flow
            try {
                const nextDrafts = await DataSource.getDraftAuthorizationsByAuthor();
                setDraftAuthorizations([...(nextDrafts ?? [])]);
            } catch (error) {
                const message = `Error loading draft authorizations: ${formatError(error)}`;
                console.error("Error loading draft authorizations", error);
                setFatalError(message);
                onError?.("Draft Load Error", message);
                return false;
            }

            // STEP 3C: Draft mods for My Work / resume flow
            try {
                const nextDraftMods = await DataSource.getDraftModsByAuthor();
                const nextDraftModMap = new Map<number, IModItem>();

                (nextDraftMods ?? []).forEach((mod: IModItem): undefined => {
                    const authorizationId = mod.authorization?.Id;

                    if (typeof authorizationId !== "number" || authorizationId <= 0) {
                        return undefined;
                    }

                    const existing = nextDraftModMap.get(authorizationId);
                    const existingModified = new Date(existing?.Modified ?? existing?.Created ?? 0).getTime();
                    const modModified = new Date(mod.Modified ?? mod.Created ?? 0).getTime();

                    if (!existing || modModified > existingModified) {
                        nextDraftModMap.set(authorizationId, mod);
                    }

                    return undefined;
                });

                setDraftModsByAuthorizationId(nextDraftModMap);
            } catch (error) {
                const message = `Error loading draft mods: ${formatError(error)}`;
                console.error("Error loading draft mods", error);
                setFatalError(message);
                onError?.("Draft Mod Load Error", message);
                return false;
            }

            // STEP 4: Current workflow runs
            try {
                const runs: IWorkflowRunItem[] = await DataSource.getCurrentWorkflowRuns();
                const nextRunMap = new Map<number, IWorkflowRunItem>();

                runs.forEach((run: IWorkflowRunItem): undefined => {
                    const authorizationId = run.authorization?.Id;

                    if (typeof authorizationId !== "number" || authorizationId <= 0) {
                        return undefined;
                    }

                    const existing = nextRunMap.get(authorizationId);

                    if (!existing) {
                        nextRunMap.set(authorizationId, run);
                        return undefined;
                    }

                    if (existing.runStatus !== "active" && run.runStatus === "active") {
                        nextRunMap.set(authorizationId, run);
                        return undefined;
                    }

                    if ((run.runNumber ?? 0) > (existing.runNumber ?? 0)) {
                        nextRunMap.set(authorizationId, run);
                    }

                    return undefined;
                });

                setRunByAuthorizationId(nextRunMap);
            } catch (error) {
                const message = `Error loading workflow runs: ${formatError(error)}`;
                console.error("Error loading workflow runs", error);
                setFatalError(message);
                onError?.("Workflow Error", message);
                return false;
            }

            setLastRefreshed(new Date().toISOString());
            return true;

        } catch (error) {
            const message = `Unexpected error during refresh: ${formatError(error)}`;
            console.error("Unexpected refresh error", error);
            setFatalError(message);
            onError?.("Unexpected Error", message);
            return false;

        } finally {
            if (isBootMode) {
                setIsBootLoading(false);
            }
            setIsRefreshing(false);
        }
    }, [enabled, onError]);

    React.useEffect((): undefined => {
        if (!enabled) {
            setIsBootLoading(false);
            return undefined;
        }

        refresh(false, "boot").catch((error: unknown) => {
            console.error("Boot refresh error", error);
        });

        return undefined;
    }, [enabled, refresh]);

    return {
        authorizations,
        draftAuthorizations,
        draftModsByAuthorizationId,
        runByAuthorizationId,
        isBootLoading,
        isRefreshing,
        lastRefreshed,
        refresh,
        fatalError,
        appUser
    };
};
