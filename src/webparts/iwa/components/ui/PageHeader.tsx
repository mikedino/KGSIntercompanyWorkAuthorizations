import * as React from "react";
import { Stack, Typography } from "@mui/material";

export interface IPageHeaderProps {
    title: string;
    subtitle: string;
}

/**
 * Shared page header used by top-level routes so title/subtitle spacing
 * stays consistent as the authorization pages get built out. It intentionally
 * stays lightweight so the papers below remain the visual focus.
 */
export const PageHeader: React.FC<IPageHeaderProps> = ({
    title,
    subtitle
}): JSX.Element => {
    return (
        <Stack spacing={0.75} sx={{ px: { xs: 0.25, md: 0.5 }, pt: 0.25, pb: 0.5 }}>
            <Typography variant="h5" fontWeight={700}>
                {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
                {subtitle}
            </Typography>
        </Stack>
    );
};
