import * as React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  IAuthorizationItem,
  IAppUserItem,
  ILaborLineItem,
  IModItem,
  IResourceItem,
  ITravelOdcItem,
  IWorkflowActionItem,
  IWorkflowRunItem
} from "./props";
import { DataSource } from "./ds";
import { RefreshMode, useIwaData } from "./iwaDataCall";
import { formatError } from "../common/utils";
import { ModService } from "../mods/modService";
import { ResourceService } from "../resources/resourceService";
import { LaborLineItemService } from "../laborlineitems/laborLineItemService";
import { TravelOdcService } from "../travelodc/travelOdcService";
import { WorkflowService } from "../workflow/workflowService";

export interface IIwaContext {
  authorizations: IAuthorizationItem[];
  draftAuthorizations: IAuthorizationItem[];
  runByAuthorizationId: Map<number, IWorkflowRunItem>;

  appUser?: IAppUserItem;
  currentUser?: IAppUserItem;
  appUsers: IAppUserItem[];
  appUserByUserId: Map<number, IAppUserItem>;
  getAppUserByUserId: (userId: number) => IAppUserItem | undefined;
  refreshCurrentUser: () => Promise<void>;
  refreshAppUsers: () => Promise<void>;
  isBootLoading: boolean;
  isRefreshing: boolean;
  lastRefreshed: string | undefined;
  fatalError?: string;

  modsByAuthorizationId: Map<number, IModItem[]>;
  runsByAuthorizationId: Map<number, IWorkflowRunItem[]>;
  actionsByAuthorizationId: Map<number, IWorkflowActionItem[]>;
  resourcesByAuthorizationId: Map<number, IResourceItem[]>;
  laborLinesByAuthorizationId: Map<number, ILaborLineItem[]>;
  travelOdcsByAuthorizationId: Map<number, ITravelOdcItem[]>;

  isAuthorizationDetailLoading: (authorizationId: number) => boolean;
  loadAuthorizationDetail: (authorizationId: number, force?: boolean) => Promise<boolean>;
  clearAuthorizationDetailCache: (authorizationId?: number) => boolean;

  dashboardActions: IWorkflowActionItem[];
  isDashboardActionsLoading: boolean;
  loadDashboardActions: (force?: boolean) => Promise<boolean>;
  clearDashboardActionsCache: () => boolean;

  myActions: IWorkflowActionItem[];
  isMyActionsLoading: boolean;
  loadMyActions: (userId: number, force?: boolean) => Promise<boolean>;
  clearMyActionsCache: () => boolean;

  refresh: (override?: boolean, mode?: RefreshMode) => Promise<boolean>;
}

export const IwaContext = React.createContext<IIwaContext | undefined>(undefined);

export interface IIwaProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
  onError?: (title: string, message: string) => boolean;
}

export const IwaProvider: React.FC<IIwaProviderProps> = ({
  children,
  enabled = true,
  onError
}): React.ReactElement => {
  const {
    authorizations,
    draftAuthorizations,
    runByAuthorizationId,
    appUser,
    isBootLoading,
    isRefreshing,
    lastRefreshed,
    fatalError,
    refresh
  } = useIwaData(onError, enabled);

  const [currentUser, setCurrentUser] = useState<IAppUserItem | undefined>(appUser);
  const [appUsers, setAppUsers] = useState<IAppUserItem[]>([]);

  const [modsByAuthorizationId, setModsByAuthorizationId] = useState<Map<number, IModItem[]>>(new Map());
  const [runsByAuthorizationId, setRunsByAuthorizationId] = useState<Map<number, IWorkflowRunItem[]>>(new Map());
  const [actionsByAuthorizationId, setActionsByAuthorizationId] = useState<Map<number, IWorkflowActionItem[]>>(new Map());
  const [resourcesByAuthorizationId, setResourcesByAuthorizationId] = useState<Map<number, IResourceItem[]>>(new Map());
  const [laborLinesByAuthorizationId, setLaborLinesByAuthorizationId] = useState<Map<number, ILaborLineItem[]>>(new Map());
  const [travelOdcsByAuthorizationId, setTravelOdcsByAuthorizationId] = useState<Map<number, ITravelOdcItem[]>>(new Map());

  const [authorizationDetailLoading, setAuthorizationDetailLoading] = useState<Map<number, boolean>>(new Map());

  const [dashboardActions, setDashboardActions] = useState<IWorkflowActionItem[]>([]);
  const [isDashboardActionsLoading, setIsDashboardActionsLoading] = useState<boolean>(false);

  const [myActions, setMyActions] = useState<IWorkflowActionItem[]>([]);
  const [isMyActionsLoading, setIsMyActionsLoading] = useState<boolean>(false);

  const authorizationDetailLoadingRef = useRef<Map<number, boolean>>(new Map());
  const modsByAuthorizationIdRef = useRef<Map<number, IModItem[]>>(new Map());
  const runsByAuthorizationIdRef = useRef<Map<number, IWorkflowRunItem[]>>(new Map());
  const actionsByAuthorizationIdRef = useRef<Map<number, IWorkflowActionItem[]>>(new Map());
  const resourcesByAuthorizationIdRef = useRef<Map<number, IResourceItem[]>>(new Map());
  const laborLinesByAuthorizationIdRef = useRef<Map<number, ILaborLineItem[]>>(new Map());
  const travelOdcsByAuthorizationIdRef = useRef<Map<number, ITravelOdcItem[]>>(new Map());

  const dashboardActionsRef = useRef<IWorkflowActionItem[]>([]);
  const isDashboardActionsLoadingRef = useRef<boolean>(false);

  const myActionsRef = useRef<IWorkflowActionItem[]>([]);
  const isMyActionsLoadingRef = useRef<boolean>(false);

  useEffect((): undefined => {
    setCurrentUser(appUser);
    return undefined;
  }, [appUser]);

  useEffect((): undefined => {
    authorizationDetailLoadingRef.current = authorizationDetailLoading;
    return undefined;
  }, [authorizationDetailLoading]);

  useEffect((): undefined => {
    modsByAuthorizationIdRef.current = modsByAuthorizationId;
    return undefined;
  }, [modsByAuthorizationId]);

  useEffect((): undefined => {
    runsByAuthorizationIdRef.current = runsByAuthorizationId;
    return undefined;
  }, [runsByAuthorizationId]);

  useEffect((): undefined => {
    actionsByAuthorizationIdRef.current = actionsByAuthorizationId;
    return undefined;
  }, [actionsByAuthorizationId]);

  useEffect((): undefined => {
    resourcesByAuthorizationIdRef.current = resourcesByAuthorizationId;
    return undefined;
  }, [resourcesByAuthorizationId]);

  useEffect((): undefined => {
    laborLinesByAuthorizationIdRef.current = laborLinesByAuthorizationId;
    return undefined;
  }, [laborLinesByAuthorizationId]);

  useEffect((): undefined => {
    travelOdcsByAuthorizationIdRef.current = travelOdcsByAuthorizationId;
    return undefined;
  }, [travelOdcsByAuthorizationId]);

  useEffect((): undefined => {
    dashboardActionsRef.current = dashboardActions;
    return undefined;
  }, [dashboardActions]);

  useEffect((): undefined => {
    isDashboardActionsLoadingRef.current = isDashboardActionsLoading;
    return undefined;
  }, [isDashboardActionsLoading]);

  useEffect((): undefined => {
    myActionsRef.current = myActions;
    return undefined;
  }, [myActions]);

  useEffect((): undefined => {
    isMyActionsLoadingRef.current = isMyActionsLoading;
    return undefined;
  }, [isMyActionsLoading]);

  const isAuthorizationDetailLoading = useCallback((authorizationId: number): boolean => {
    return authorizationDetailLoading.get(authorizationId) ?? false;
  }, [authorizationDetailLoading]);

  const refreshCurrentUser = useCallback(async (): Promise<void> => {
    const nextUser = await DataSource.getOrCreateCurrentUser();
    setCurrentUser(nextUser);
  }, []);

  const refreshAppUsers = useCallback(async (): Promise<void> => {
    const nextUsers = await DataSource.getAppUsers();
    setAppUsers(nextUsers ?? []);
  }, []);

  const appUserByUserId = React.useMemo<Map<number, IAppUserItem>>(() => {
    const nextMap = new Map<number, IAppUserItem>();

    appUsers.forEach((profile: IAppUserItem): undefined => {
      const userId = profile.user?.Id;

      if (typeof userId === "number" && userId > 0) {
        nextMap.set(userId, profile);
      }

      return undefined;
    });

    return nextMap;
  }, [appUsers]);

  const getAppUserByUserId = useCallback((userId: number): IAppUserItem | undefined => {
    return appUserByUserId.get(userId);
  }, [appUserByUserId]);

  const clearAuthorizationDetailCache = useCallback((authorizationId?: number): boolean => {
    if (typeof authorizationId === "number" && authorizationId > 0) {
      setModsByAuthorizationId((prev: Map<number, IModItem[]>): Map<number, IModItem[]> => {
        const next = new Map(prev);
        next.delete(authorizationId);
        return next;
      });

      setRunsByAuthorizationId((prev: Map<number, IWorkflowRunItem[]>): Map<number, IWorkflowRunItem[]> => {
        const next = new Map(prev);
        next.delete(authorizationId);
        return next;
      });

      setActionsByAuthorizationId((prev: Map<number, IWorkflowActionItem[]>): Map<number, IWorkflowActionItem[]> => {
        const next = new Map(prev);
        next.delete(authorizationId);
        return next;
      });

      setResourcesByAuthorizationId((prev: Map<number, IResourceItem[]>): Map<number, IResourceItem[]> => {
        const next = new Map(prev);
        next.delete(authorizationId);
        return next;
      });

      setLaborLinesByAuthorizationId((prev: Map<number, ILaborLineItem[]>): Map<number, ILaborLineItem[]> => {
        const next = new Map(prev);
        next.delete(authorizationId);
        return next;
      });

      setTravelOdcsByAuthorizationId((prev: Map<number, ITravelOdcItem[]>): Map<number, ITravelOdcItem[]> => {
        const next = new Map(prev);
        next.delete(authorizationId);
        return next;
      });

      setAuthorizationDetailLoading((prev: Map<number, boolean>): Map<number, boolean> => {
        const next = new Map(prev);
        next.delete(authorizationId);
        authorizationDetailLoadingRef.current = next;
        return next;
      });

      return true;
    }

    setModsByAuthorizationId(new Map());
    setRunsByAuthorizationId(new Map());
    setActionsByAuthorizationId(new Map());
    setResourcesByAuthorizationId(new Map());
    setLaborLinesByAuthorizationId(new Map());
    setTravelOdcsByAuthorizationId(new Map());
    authorizationDetailLoadingRef.current = new Map();
    setAuthorizationDetailLoading(new Map());

    return true;
  }, []);

  const loadAuthorizationDetail = useCallback(async (
    authorizationId: number,
    force = false
  ): Promise<boolean> => {
    if (!authorizationId || authorizationId <= 0) {
      return false;
    }

    const hasAllCached =
      modsByAuthorizationIdRef.current.has(authorizationId) &&
      runsByAuthorizationIdRef.current.has(authorizationId) &&
      actionsByAuthorizationIdRef.current.has(authorizationId) &&
      resourcesByAuthorizationIdRef.current.has(authorizationId) &&
      laborLinesByAuthorizationIdRef.current.has(authorizationId) &&
      travelOdcsByAuthorizationIdRef.current.has(authorizationId);

    if (!force && hasAllCached) {
      return true;
    }

    if (!force && authorizationDetailLoadingRef.current.get(authorizationId)) {
      return false;
    }

    if (force && authorizationDetailLoadingRef.current.get(authorizationId)) {
      setAuthorizationDetailLoading((prev: Map<number, boolean>): Map<number, boolean> => {
        const next = new Map(prev);
        next.set(authorizationId, false);
        authorizationDetailLoadingRef.current = next;
        return next;
      });
    }

    setAuthorizationDetailLoading((prev: Map<number, boolean>): Map<number, boolean> => {
      const next = new Map(prev);
      next.set(authorizationId, true);
      authorizationDetailLoadingRef.current = next;
      return next;
    });

    try {
      const [
        mods,
        runs,
        actions,
        resources,
        laborLines,
        travelOdcs
      ] = await Promise.all([
        ModService.getByAuthorization(authorizationId),
        WorkflowService.getRunsByAuthorization(authorizationId),
        WorkflowService.getActionsByAuthorization(authorizationId),
        ResourceService.getByAuthorization(authorizationId),
        LaborLineItemService.getByAuthorization(authorizationId),
        TravelOdcService.getByAuthorization(authorizationId)
      ]);

      const sortedMods: IModItem[] = [...(mods ?? [])].sort((a: IModItem, b: IModItem): number => {
        return (a.modNumber ?? 0) - (b.modNumber ?? 0);
      });

      const sortedRuns: IWorkflowRunItem[] = [...(runs ?? [])].sort((a: IWorkflowRunItem, b: IWorkflowRunItem): number => {
        return (b.runNumber ?? 0) - (a.runNumber ?? 0);
      });

      const sortedActions: IWorkflowActionItem[] = [...(actions ?? [])].sort((a: IWorkflowActionItem, b: IWorkflowActionItem): number => {
        return new Date(b.actionDate).getTime() - new Date(a.actionDate).getTime();
      });

      const sortedResources: IResourceItem[] = [...(resources ?? [])].sort((a: IResourceItem, b: IResourceItem): number => {
        return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      });

      const sortedLaborLines: ILaborLineItem[] = [...(laborLines ?? [])].sort((a: ILaborLineItem, b: ILaborLineItem): number => {
        return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      });

      const sortedTravelOdcs: ITravelOdcItem[] = [...(travelOdcs ?? [])].sort((a: ITravelOdcItem, b: ITravelOdcItem): number => {
        return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      });

      setModsByAuthorizationId((prev: Map<number, IModItem[]>): Map<number, IModItem[]> => {
        const next = new Map(prev);
        next.set(authorizationId, sortedMods);
        return next;
      });

      setRunsByAuthorizationId((prev: Map<number, IWorkflowRunItem[]>): Map<number, IWorkflowRunItem[]> => {
        const next = new Map(prev);
        next.set(authorizationId, sortedRuns);
        return next;
      });

      setActionsByAuthorizationId((prev: Map<number, IWorkflowActionItem[]>): Map<number, IWorkflowActionItem[]> => {
        const next = new Map(prev);
        next.set(authorizationId, sortedActions);
        return next;
      });

      setResourcesByAuthorizationId((prev: Map<number, IResourceItem[]>): Map<number, IResourceItem[]> => {
        const next = new Map(prev);
        next.set(authorizationId, sortedResources);
        return next;
      });

      setLaborLinesByAuthorizationId((prev: Map<number, ILaborLineItem[]>): Map<number, ILaborLineItem[]> => {
        const next = new Map(prev);
        next.set(authorizationId, sortedLaborLines);
        return next;
      });

      setTravelOdcsByAuthorizationId((prev: Map<number, ITravelOdcItem[]>): Map<number, ITravelOdcItem[]> => {
        const next = new Map(prev);
        next.set(authorizationId, sortedTravelOdcs);
        return next;
      });

      return true;

    } catch (error) {
      const message = `Error loading authorization detail for authorization ${authorizationId}: ${formatError(error)}`;
      console.error("Error loading authorization detail", error);
      onError?.("Authorization Detail Error", message);
      return false;

    } finally {
      setAuthorizationDetailLoading((prev: Map<number, boolean>): Map<number, boolean> => {
        const next = new Map(prev);
        next.set(authorizationId, false);
        authorizationDetailLoadingRef.current = next;
        return next;
      });
    }
  }, [onError]);

  const clearDashboardActionsCache = useCallback((): boolean => {
    setDashboardActions([]);
    return true;
  }, []);

  const loadDashboardActions = useCallback(async (force = false): Promise<boolean> => {
    if (!force && dashboardActionsRef.current.length > 0) {
      return true;
    }

    if (isDashboardActionsLoadingRef.current) {
      return false;
    }

    setIsDashboardActionsLoading(true);

    try {
      const actions = await WorkflowService.getDashboardActions();

      const sortedActions: IWorkflowActionItem[] = [...(actions ?? [])].sort((a: IWorkflowActionItem, b: IWorkflowActionItem): number => {
        return new Date(b.actionDate).getTime() - new Date(a.actionDate).getTime();
      });

      setDashboardActions(sortedActions);
      return true;

    } catch (error) {
      const message = `Error loading dashboard actions: ${formatError(error)}`;
      console.error("Error loading dashboard actions", error);
      onError?.("Dashboard Error", message);
      return false;

    } finally {
      setIsDashboardActionsLoading(false);
    }
  }, [onError]);

  const clearMyActionsCache = useCallback((): boolean => {
    setMyActions([]);
    return true;
  }, []);

  const loadMyActions = useCallback(async (
    userId: number,
    force = false
  ): Promise<boolean> => {
    if (!userId || userId <= 0) {
      return false;
    }

    if (!force && myActionsRef.current.length > 0) {
      return true;
    }

    if (isMyActionsLoadingRef.current) {
      return false;
    }

    setIsMyActionsLoading(true);

    try {
      const actions = await WorkflowService.getMyActions(userId);

      const sortedActions: IWorkflowActionItem[] = [...(actions ?? [])].sort((a: IWorkflowActionItem, b: IWorkflowActionItem): number => {
        return new Date(b.actionDate).getTime() - new Date(a.actionDate).getTime();
      });

      setMyActions(sortedActions);
      return true;

    } catch (error) {
      const message = `Error loading My Work actions: ${formatError(error)}`;
      console.error("Error loading My Work actions", error);
      onError?.("My Work Error", message);
      return false;

    } finally {
      setIsMyActionsLoading(false);
    }
  }, [onError]);

  const value = React.useMemo<IIwaContext>(() => {
    return {
      authorizations,
      draftAuthorizations,
      runByAuthorizationId,

      appUser: currentUser,
      currentUser,
      appUsers,
      appUserByUserId,
      getAppUserByUserId,
      refreshCurrentUser,
      refreshAppUsers,
      isBootLoading,
      isRefreshing,
      lastRefreshed,
      fatalError,

      modsByAuthorizationId,
      runsByAuthorizationId,
      actionsByAuthorizationId,
      resourcesByAuthorizationId,
      laborLinesByAuthorizationId,
      travelOdcsByAuthorizationId,

      isAuthorizationDetailLoading,
      loadAuthorizationDetail,
      clearAuthorizationDetailCache,

      dashboardActions,
      isDashboardActionsLoading,
      loadDashboardActions,
      clearDashboardActionsCache,

      myActions,
      isMyActionsLoading,
      loadMyActions,
      clearMyActionsCache,

      refresh
    };
  }, [
    actionsByAuthorizationId,
    authorizations,
    draftAuthorizations,
    appUserByUserId,
    appUsers,
    clearAuthorizationDetailCache,
    clearDashboardActionsCache,
    clearMyActionsCache,
    currentUser,
    dashboardActions,
    fatalError,
    getAppUserByUserId,
    isAuthorizationDetailLoading,
    isBootLoading,
    isDashboardActionsLoading,
    isMyActionsLoading,
    isRefreshing,
    lastRefreshed,
    loadAuthorizationDetail,
    loadDashboardActions,
    loadMyActions,
    modsByAuthorizationId,
    myActions,
    refresh,
    refreshAppUsers,
    refreshCurrentUser,
    resourcesByAuthorizationId,
    laborLinesByAuthorizationId,
    runByAuthorizationId,
    runsByAuthorizationId,
    travelOdcsByAuthorizationId
  ]);

  return (
    <IwaContext.Provider value={value}>
      {children}
    </IwaContext.Provider>
  );
};

export const useIwa = (): IIwaContext => {
  const value = React.useContext(IwaContext);

  if (!value) {
    throw new Error("useIwa must be used inside IwaProvider.");
  }

  return value;
};
