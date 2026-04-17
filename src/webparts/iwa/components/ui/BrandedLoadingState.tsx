import * as React from "react";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import Strings from "../common/strings";

export interface IBrandedLoadingStateProps {
    message: string;
    useDarkTheme: boolean;
}

/**
 * Shared branded loading state for the config gate and app boot screens.
 */
export const BrandedLoadingState: React.FC<IBrandedLoadingStateProps> = ({
    message,
    useDarkTheme
}): JSX.Element => {
    const logoSrc = useDarkTheme ? Strings.LogoWhite : Strings.LogoDark;

    return (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
            <Stack spacing={3} alignItems="center">
                <Box
                    component="img"
                    src={logoSrc}
                    alt={Strings.ProjectName}
                    sx={{
                        width: { xs: 220, sm: 280 },
                        maxWidth: "80vw",
                        height: "auto"
                    }}
                />
                <CircularProgress size={80} thickness={4} enableTrackSlot color="info" />
                <Typography variant="h5" fontWeight={500}>
                    {message}
                </Typography>
            </Stack>
        </Box>
    );
};
