import * as React from "react";
import { Box, ButtonBase, Grid, Paper, Stack, Typography } from "@mui/material";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import { useHistory } from "react-router-dom";
import { IDashboardMetric } from "./dashboardUtils";

export const DashboardMetricCards: React.FC<{ metrics: IDashboardMetric[] }> = ({ metrics }): JSX.Element => {
    const history = useHistory();

    return (
        <Grid container spacing={1.5}>
            {metrics.map((metric) => (
                <Grid key={metric.key} size={{ xs: 12, sm: 6, lg: 2.4 }}>
                    <ButtonBase
                        onClick={() => metric.route && history.push(metric.route)}
                        sx={{ display: "block", width: "100%", height: "100%", textAlign: "left", borderRadius: 2 }}
                        disabled={!metric.route}
                    >
                        <Paper
                            variant="outlined"
                            sx={{
                                px: 1.75,
                                pt: 1.55,
                                pb: 1.35,
                                height: "100%",
                                borderLeft: "5px solid",
                                borderLeftColor: "primary.main",
                                transition: "border-color 120ms ease, box-shadow 120ms ease",
                                "&:hover": metric.route ? { boxShadow: 2, borderLeftColor: "secondary.main" } : undefined
                            }}
                        >
                            <Stack spacing={0.65}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                    <Typography color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase", fontSize: 13 }}>
                                        {metric.label}
                                    </Typography>
                                    {metric.route && <ArrowForwardOutlinedIcon fontSize="small" color="action" />}
                                </Stack>
                                <Typography variant="h5" fontWeight={800}>{metric.value}</Typography>
                                <Box sx={{ minHeight: 26 }}>
                                    <Typography variant="caption" color="text.secondary">{metric.detail}</Typography>
                                </Box>
                            </Stack>
                        </Paper>
                    </ButtonBase>
                </Grid>
            ))}
        </Grid>
    );
};
