import * as React from "react";
import {
    Box,
    Button,
    Paper,
    Stack,
    Typography
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export const NotFoundPage: React.FC = (): JSX.Element => {
    return (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
            <Paper sx={{ p: 4, borderRadius: 3, maxWidth: 520, width: "100%" }}>
                <Stack spacing={2}>
                    <Typography variant="h4" fontWeight={700}>
                        Page Not Found
                    </Typography>

                    <Typography color="text.secondary">
                        The page you requested does not exist or is not available.
                    </Typography>

                    <Box>
                        <Button
                            variant="contained"
                            component={RouterLink}
                            to="/dashboard"
                        >
                            Go to Dashboard
                        </Button>
                    </Box>
                </Stack>
            </Paper>
        </Box>
    );
};