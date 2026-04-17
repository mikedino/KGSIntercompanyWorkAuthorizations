import * as React from "react";
import { PageHeader } from "../ui/PageHeader";

export const DashboardPage: React.FC = (): JSX.Element => {
    return (
        <PageHeader
            title="Dashboard"
            subtitle="This page will summarize authorization status, workflow activity, and audit-oriented metrics for the IWA process."
        />
    );
};
