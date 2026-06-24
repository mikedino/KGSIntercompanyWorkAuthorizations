import * as React from "react";
import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Snackbar, Stack, Tab, Tabs, Typography } from "@mui/material";
import { DataSource } from "../data/ds";
import { IConfigItem, ILobItem, IOgItem, IEntityItem } from "../data/props";
import RefreshIcon from "@mui/icons-material/Refresh";
import { formatError } from "../common/utils";
import { UsersAdminPanel } from "./UserPanel";
import { ApproversAdminPanel } from "./ApproversPanel";
import { MigrationTrialPanel } from "./MigrationTrialPanel";
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { useTheme } from "@mui/material/styles";
import { AppUserService } from "../users/userService";
import { useIwa } from "../data/iwaContext";
import { useShellUi } from "../ui/ShellUiContext";
import { AdminLookupWriteService } from "./adminLookupWriteService";

type AdminTabKey = "users" | "approvers" | "migration";

interface AdminModuleProps {
  context: WebPartContext;
}

const AdminPage: React.FC<AdminModuleProps> = ({ context }) => {

  if (!DataSource.isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">You do not have access to Admin settings.</Alert>
      </Box>
    );
  }

  AdminLookupWriteService.configure(context);

  const [tab, setTab] = useState<AdminTabKey>("users");

  // load user context
  const { appUsers, refreshAppUsers, isRefreshing } = useIwa();

  // load Shell UI
  const { showBusy, hideBusy } = useShellUi();

  // Approver data is already in DataSource.init(); keep a local snapshot to re-render on save/refresh
  const [config, setConfig] = useState<IConfigItem[]>([]);
  const [lobs, setLobs] = useState<ILobItem[]>([]);
  const [ogs, setOgs] = useState<IOgItem[]>([]);
  const [entities, setEntities] = useState<IEntityItem[]>([]);
  const [lookupsError, setLookupsError] = useState<string>("");
  const [snackbar, setSnackbar] = React.useState<{ message: string; severity: "success" | "error"; } | undefined>(undefined);

  const theme = useTheme();

  // helper to show success
  const showSuccess = (message: string): void => {
    setSnackbar({ message, severity: "success" });
  };

  // busy helper - no re-renders
  const withBusy = React.useCallback(async <T,>(message: string, fn: () => Promise<T>): Promise<T> => {
    showBusy(message);
    try {
      return await fn();
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      hideBusy();
    }
  }, [showBusy, hideBusy]);

  const syncLookupsFromCache = (): void => {
    setConfig(DataSource.Config ?? []);
    setLobs(DataSource.LOBs ?? []);
    setOgs(DataSource.OGs ?? []);
    setEntities(DataSource.Entities ?? []);
  };

  const refreshLookups = async (): Promise<void> => {
    setLookupsError("");
    try {
      // refresh from server (safe even if already loaded)
      await Promise.all([
        DataSource.getConfig(),
        DataSource.getLOBs(),
        DataSource.getOGs(),
        DataSource.getEntities()
      ]);

      syncLookupsFromCache();
    } catch (e) {
      const msg = `Failed to refresh approver lookups: ${formatError(e)}`;
      setLookupsError(msg);
      throw e;
    }
  };

  const handleRefreshClick = async (): Promise<void> => {
    if (tab === "users") {
      await withBusy("Refreshing users…", refreshAppUsers);
    } else if (tab === "approvers") {
      await withBusy("Refreshing approver lookups…", refreshLookups);
    }
  };

  useEffect(() => {
    syncLookupsFromCache();
  }, []);

  useEffect(() => {
    if (appUsers.length > 0) {
      return;
    }

    handleRefreshClick().catch((e) =>{ console.error("Error loading users on mount", e)});

  }, [appUsers.length]);

  return (
    <>
      <Box sx={{ width: "100%" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={700}>Admin Panel</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage users and default approvers              
            </Typography>
          </Box>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefreshClick}
          >
            Refresh
          </Button>
        </Stack>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v as AdminTabKey)}
          sx={{
            mb: 2,

            // Indicator color
            "& .MuiTabs-indicator": {
              backgroundColor: theme.palette.action.active,
            },

            // Selected tab color
            "& .MuiTab-root.Mui-selected": {
              color: theme.palette.action.active
            }
          }}
        >
          <Tab value="users" label="Users" />
          <Tab value="approvers" label="Approvers" />
          <Tab value="migration" label="Migration" />
        </Tabs>

        {tab === "users" && (
          <>
            {/* {usersError && <Alert severity="error" sx={{ mb: 2 }}>{usersError}</Alert>} */}

            {!appUsers.length && isRefreshing ? (
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 4 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">Loading users...</Typography>
              </Stack>
            ) : (

              <UsersAdminPanel
                users={appUsers}
                peoplePickerContext={{
                  absoluteUrl: context.pageContext.web.absoluteUrl,
                  msGraphClientFactory: context.msGraphClientFactory,
                  spHttpClient: context.spHttpClient
                }}
                onRoleChanged={async (appUserItemId, role) => {
                  await withBusy("Saving user role…", async () => {
                    await DataSource.updateAppUserRole(appUserItemId, role);
                    await refreshAppUsers();
                  });
                }}
                onAddUser={async (person, role, modePreference) => {
                  await withBusy("Adding user…", async () => {
                    await AppUserService.createNewUserInAdminPanel(Number(person.id), role, modePreference);
                    await refreshAppUsers();
                  });
                }}
              />
            )}
          </>
        )}

        {tab === "approvers" && (
          <>
            {lookupsError && <Alert severity="error" sx={{ mb: 2 }}>{lookupsError}</Alert>}

            <ApproversAdminPanel
              context={context}
              config={config}
              lobs={lobs}
              ogs={ogs}
              entities={entities}
              runBusy={withBusy}
              onSaved={refreshLookups}
              onSuccess={showSuccess}
            />
          </>
        )}

        {tab === "migration" && (
          <MigrationTrialPanel
            context={context}
            runBusy={withBusy}
            onSuccess={showSuccess}
          />
        )}
      </Box>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        transitionDuration={200}
        onClose={() => setSnackbar(undefined)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        {snackbar && (
          <Alert
            onClose={() => setSnackbar(undefined)}
            severity={snackbar.severity}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        )}
      </Snackbar>
    </>
  );
};

export default AdminPage;
