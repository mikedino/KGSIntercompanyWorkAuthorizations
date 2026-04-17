import * as React from "react";
import { PageHeader } from "../ui/PageHeader";

export const AllAuthorizationsPage: React.FC = (): JSX.Element => {
    return (
        <PageHeader
            title="All Authorizations"
            subtitle="This page will host the main authorization grid, filters, status chips, and entry points into create, edit, and view experiences."
        />
    );
};
