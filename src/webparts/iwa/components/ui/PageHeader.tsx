import * as React from "react";
import { Paper, Stack, Typography } from "@mui/material";

export interface IPageHeaderProps {
    title: string;
    subtitle: string;
}

/**
 * Shared page header used by top-level routes so title/subtitle spacing
 * stays consistent as the authorization pages get built out.
 */
export const PageHeader: React.FC<IPageHeaderProps> = ({
    title,
    subtitle
}): JSX.Element => {
    return (
        <Paper sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3 }}>
            <Stack spacing={1}>
                <Typography variant="h4" fontWeight={700}>
                    {title}
                </Typography>
                <Typography color="text.secondary">
                    {subtitle}
                </Typography>
            </Stack>
        </Paper>
    );
};
