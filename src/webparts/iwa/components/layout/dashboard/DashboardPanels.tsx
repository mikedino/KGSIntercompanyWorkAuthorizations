import * as React from "react";
import {
    Box,
    Button,
    Chip,
    Divider,
    Grid,
    LinearProgress,
    Paper,
    Stack,
    Typography
} from "@mui/material";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { useHistory } from "react-router-dom";
import {
    IDashboardActivityItem,
    IDashboardAttentionItem,
    IDashboardFundingBar,
    IDashboardQueueItem,
    IDashboardRecentIwa
} from "./dashboardUtils";

const sectionPaperSx = {
    p: 2,
    height: "100%",
    borderRadius: 2
};

const EmptyState: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => (
    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>{children}</Typography>
);

export const WorkflowQueuePanel: React.FC<{ queue: IDashboardQueueItem[] }> = ({ queue }): JSX.Element => {
    const history = useHistory();
    const total = queue.reduce((sum, item) => sum + item.count, 0);

    return (
        <Paper variant="outlined" sx={sectionPaperSx}>
            <Stack spacing={1.5}>
                <Typography variant="h6" fontWeight={700}>Workflow Queue</Typography>
                <Stack spacing={1}>
                    {queue.map((item) => (
                        <Box key={item.role}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                <Button size="small" onClick={() => history.push(item.route)} sx={{ justifyContent: "flex-start", px: 0 }}>
                                    {item.label}
                                </Button>
                                <Typography variant="body2" fontWeight={700}>{item.count}</Typography>
                            </Stack>
                            <LinearProgress
                                variant="determinate"
                                value={total > 0 ? Math.max(4, (item.count / total) * 100) : 0}
                                sx={{ height: 7, borderRadius: 999 }}
                            />
                        </Box>
                    ))}
                </Stack>
            </Stack>
        </Paper>
    );
};

export const FundingBarPanel: React.FC<{
    title: string;
    rows: IDashboardFundingBar[];
}> = ({ title, rows }): JSX.Element => (
    <Paper variant="outlined" sx={sectionPaperSx}>
        <Stack spacing={1.5}>
            <Typography variant="h6" fontWeight={700}>{title}</Typography>
            {rows.length === 0 ? (
                <EmptyState>No active funding to display.</EmptyState>
            ) : (
                <Stack spacing={1.25}>
                    {rows.map((row) => (
                        <Box key={row.key}>
                            <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
                                <Typography variant="body2" fontWeight={600} noWrap>{row.label}</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>{row.formattedValue}</Typography>
                            </Stack>
                            <LinearProgress
                                variant="determinate"
                                value={row.percent}
                                sx={{ height: 8, borderRadius: 999, mt: 0.5 }}
                            />
                        </Box>
                    ))}
                </Stack>
            )}
        </Stack>
    </Paper>
);

const getAttentionIcon = (severity: IDashboardAttentionItem["severity"]): JSX.Element => {
    if (severity === "error") {
        return <ErrorOutlineOutlinedIcon color="error" />;
    }

    if (severity === "warning") {
        return <WarningAmberOutlinedIcon color="warning" />;
    }

    return <InsightsOutlinedIcon color="info" />;
};

export const AttentionPanel: React.FC<{ items: IDashboardAttentionItem[] }> = ({ items }): JSX.Element => {
    const history = useHistory();

    return (
        <Paper variant="outlined" sx={sectionPaperSx}>
            <Stack spacing={1.5}>
                <Typography variant="h6" fontWeight={700}>Attention Needed</Typography>
                {items.length === 0 ? (
                    <EmptyState>No exceptions or time-sensitive items found.</EmptyState>
                ) : (
                    <Stack divider={<Divider flexItem />} spacing={1}>
                        {items.map((item) => (
                            <Stack key={item.key} direction="row" spacing={1.25} alignItems="flex-start">
                                {getAttentionIcon(item.severity)}
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                        <Typography fontWeight={700}>{item.title}</Typography>
                                        <Chip size="small" label={item.label} color={item.severity === "error" ? "error" : item.severity === "warning" ? "warning" : "info"} variant="outlined" />
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary">{item.detail}</Typography>
                                </Box>
                                <Button size="small" endIcon={<OpenInNewOutlinedIcon />} onClick={() => history.push(item.route)}>
                                    Open
                                </Button>
                            </Stack>
                        ))}
                    </Stack>
                )}
            </Stack>
        </Paper>
    );
};

const getActivityIcon = (tone: IDashboardActivityItem["tone"]): JSX.Element => {
    switch (tone) {
        case "success":
            return <CheckCircleOutlineOutlinedIcon color="success" />;
        case "error":
            return <ErrorOutlineOutlinedIcon color="error" />;
        case "warning":
            return <ScheduleOutlinedIcon color="warning" />;
        case "info":
        default:
            return <InsightsOutlinedIcon color="info" />;
    }
};

export const RecentActivityPanel: React.FC<{ items: IDashboardActivityItem[] }> = ({ items }): JSX.Element => {
    const history = useHistory();

    return (
        <Paper variant="outlined" sx={sectionPaperSx}>
            <Stack spacing={1.5}>
                <Typography variant="h6" fontWeight={700}>Recent Activity</Typography>
                {items.length === 0 ? (
                    <EmptyState>No recent workflow activity found.</EmptyState>
                ) : (
                    <Stack spacing={1.25}>
                        {items.map((item) => (
                            <Stack key={item.key} direction="row" spacing={1.25} alignItems="flex-start">
                                {getActivityIcon(item.tone)}
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Button onClick={() => history.push(item.route)} sx={{ p: 0, justifyContent: "flex-start", textAlign: "left" }}>
                                        <Typography fontWeight={700}>{item.title}</Typography>
                                    </Button>
                                    <Typography variant="body2" color="text.secondary">{item.detail || "Workflow activity recorded"}</Typography>
                                    <Typography variant="caption" color="text.secondary">{item.when}</Typography>
                                </Box>
                            </Stack>
                        ))}
                    </Stack>
                )}
            </Stack>
        </Paper>
    );
};

export const RecentIwasPanel: React.FC<{ items: IDashboardRecentIwa[] }> = ({ items }): JSX.Element => {
    const history = useHistory();

    return (
        <Paper variant="outlined" sx={sectionPaperSx}>
            <Stack spacing={1.5}>
                <Typography variant="h6" fontWeight={700}>Recently Touched</Typography>
                {items.length === 0 ? (
                    <EmptyState>No recent authorizations found.</EmptyState>
                ) : (
                    <Stack divider={<Divider flexItem />} spacing={1}>
                        {items.map((item) => (
                            <Stack key={item.key} direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                                <Box sx={{ minWidth: 0 }}>
                                    <Button onClick={() => history.push(item.route)} sx={{ p: 0, justifyContent: "flex-start", textAlign: "left" }}>
                                        <Typography fontWeight={700}>{item.title}</Typography>
                                    </Button>
                                    <Typography variant="body2" color="text.secondary" noWrap>{item.detail}</Typography>
                                </Box>
                                <Typography fontWeight={700} sx={{ whiteSpace: "nowrap" }}>{item.amount}</Typography>
                            </Stack>
                        ))}
                    </Stack>
                )}
            </Stack>
        </Paper>
    );
};

export const QuickActionsPanel: React.FC = (): JSX.Element => {
    const history = useHistory();
    const actions = [
        ["New IWA", "/authorizations/new"],
        ["My Work", "/my-work"],
        ["Active Queue", "/all-authorizations/pending"],
        ["Expiring Soon", "/all-authorizations/expiringSoon"],
        ["With Mods", "/all-authorizations/withMods"]
    ];

    return (
        <Paper variant="outlined" sx={sectionPaperSx}>
            <Stack spacing={1.5}>
                <Typography variant="h6" fontWeight={700}>Quick Actions</Typography>
                <Grid container spacing={1}>
                    {actions.map(([label, route]) => (
                        <Grid key={route} size={{ xs: 12, sm: 6 }}>
                            <Button fullWidth variant="outlined" onClick={() => history.push(route)} endIcon={<OpenInNewOutlinedIcon />}>
                                {label}
                            </Button>
                        </Grid>
                    ))}
                </Grid>
            </Stack>
        </Paper>
    );
};
