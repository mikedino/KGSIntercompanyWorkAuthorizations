import * as React from "react";
import { Alert, Box, CircularProgress, Grid, Stack } from "@mui/material";
import { PageHeader } from "../ui/PageHeader";
import { useIwa } from "../data/iwaContext";
import { DashboardMetricCards } from "./dashboard/DashboardCards";
import {
    AttentionPanel,
    FundingBarPanel,
    QuickActionsPanel,
    RecentActivityPanel,
    RecentIwasPanel,
    WorkflowQueuePanel
} from "./dashboard/DashboardPanels";
import { buildDashboardModel } from "./dashboard/dashboardUtils";

export const DashboardPage: React.FC = (): JSX.Element => {
    const {
        authorizations,
        dashboardActions,
        draftAuthorizations,
        draftModsByAuthorizationId,
        isBootLoading,
        isDashboardActionsLoading,
        loadDashboardActions,
        runByAuthorizationId
    } = useIwa();

    React.useEffect(() => {
        loadDashboardActions().catch(console.error);
    }, [loadDashboardActions]);

    const model = React.useMemo(() => {
        return buildDashboardModel(
            authorizations,
            draftAuthorizations,
            runByAuthorizationId,
            draftModsByAuthorizationId,
            dashboardActions
        );
    }, [authorizations, dashboardActions, draftAuthorizations, draftModsByAuthorizationId, runByAuthorizationId]);

    return (
        <Stack spacing={2.5}>
            <PageHeader
                title="Dashboard"
                subtitle="Operational view of active authorizations, approval queues, funding exposure, and recent workflow movement."
            />

            {isBootLoading && (
                <Alert icon={<CircularProgress size={18} />} severity="info">
                    Loading authorization data...
                </Alert>
            )}

            <DashboardMetricCards metrics={model.metrics} />

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <WorkflowQueuePanel queue={model.queue} />
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <FundingBarPanel title="Funding by Operating Group" rows={model.fundingByOg} />
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <FundingBarPanel title="Funding by Recipient Entity" rows={model.fundingByEntity} />
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, xl: 7 }}>
                    <AttentionPanel items={model.attention} />
                </Grid>
                <Grid size={{ xs: 12, xl: 5 }}>
                    <QuickActionsPanel />
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <RecentActivityPanel items={model.activity} />
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <RecentIwasPanel items={model.recentIwas} />
                </Grid>
            </Grid>

            {isDashboardActionsLoading && (
                <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                    <CircularProgress size={22} />
                </Box>
            )}
        </Stack>
    );
};
