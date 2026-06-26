import * as React from "react";
import { Box, Grid, Link, Paper, Stack, Typography } from "@mui/material";
import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import SlideshowOutlinedIcon from "@mui/icons-material/SlideshowOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import { ContextInfo } from "gd-sprest";
import { IAuthorizationItem, IModItem } from "../../data/props";
import { formatCurrency, formatDate } from "../../common/utils";
import { maskedCurrencyText } from "../financialAccess";
import { contractTypeLabels } from "./iwaViewUtils";

export interface IViewAttachmentItem {
    FileName: string;
    ServerRelativeUrl?: string;
    UniqueId?: string;
}

interface IIwaSummaryTabProps {
    authorization: IAuthorizationItem;
    attachments: IViewAttachmentItem[];
    canViewFinancials: boolean;
    latestMod?: IModItem;
}

const officeExtensions = new Set([
    "docx", "docm", "dotx", "dotm", "doc",
    "xlsx", "xlsm", "xlsb", "xltx", "xltm", "xls",
    "pptx", "pptm", "ppsx", "ppsm", "potx", "potm", "ppt",
    "one", "onetoc2", "vsdx", "vsdm", "vssx", "vssm", "vstx", "vstm"
]);

const getExtension = (fileName: string): string => fileName.split(".").pop()?.toLowerCase() ?? "";

const isOfficeDocument = (fileName: string): boolean => officeExtensions.has(getExtension(fileName));

const getAttachmentIcon = (fileName: string): JSX.Element => {
    const extension = getExtension(fileName);

    if (["doc", "docx", "docm", "dotx", "dotm"].includes(extension)) {
        return <DescriptionOutlinedIcon fontSize="small" />;
    }

    if (["xls", "xlsx", "xlsm", "xlsb", "xltx", "xltm", "csv"].includes(extension)) {
        return <TableChartOutlinedIcon fontSize="small" />;
    }

    if (["ppt", "pptx", "pptm", "ppsx", "ppsm", "potx", "potm"].includes(extension)) {
        return <SlideshowOutlinedIcon fontSize="small" />;
    }

    if (extension === "pdf") {
        return <PictureAsPdfOutlinedIcon fontSize="small" />;
    }

    if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "tif", "tiff"].includes(extension)) {
        return <ImageOutlinedIcon fontSize="small" />;
    }

    return <AttachFileOutlinedIcon fontSize="small" />;
};

const buildAttachmentUrl = (attachment: IViewAttachmentItem): string => {
    const fileName = attachment.FileName ?? "";
    const serverRelativeUrl = attachment.ServerRelativeUrl ?? "";
    const directUrl = serverRelativeUrl.startsWith("http")
        ? serverRelativeUrl
        : `${document.location.origin}${serverRelativeUrl}`;

    if (!fileName || !isOfficeDocument(fileName) || !attachment.UniqueId) {
        return directUrl;
    }

    return `${ContextInfo.webAbsoluteUrl}/_layouts/15/WopiFrame.aspx?sourcedoc=${attachment.UniqueId}&file=${encodeURIComponent(fileName)}&action=default`;
};

const SummaryCard: React.FC<{
    title: string;
    children: React.ReactNode;
    height?: string;
}> = ({ title, children, height }): JSX.Element => (
    <Paper
        variant="outlined"
        sx={{
            position: "relative",
            px: 1.75,
            pb: 1.75,
            pt: 3.25,
            height
        }}
    >
        <Box
        sx={(theme) => ({
            position: "absolute",
            top: 0,
            left: 16,
            transform: "translateY(-50%)",
            px: 0.75,
            bgcolor: "background.paper",
            color: "text.primary",
            maxWidth: "calc(100% - 32px)",
            zIndex: 1
        })}
        >
            <Typography variant="h6" fontWeight={600} noWrap>
                {title}
            </Typography>
        </Box>
        {children}
    </Paper>
);

export const IwaSummaryTab: React.FC<IIwaSummaryTabProps> = ({ authorization, attachments, canViewFinancials, latestMod }): JSX.Element => (
    <Grid container columnSpacing={1.5} rowSpacing={2}>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
            <SummaryCard title="Contract" height="100%">
                <Grid container spacing={1.25}>
                    {[
                        ["Contract ID", authorization.contractId || "-"],
                        ["Contract Name", authorization.contractName || "-"],
                        ["Invoice / Task Order", authorization.invoice || "Not specified"],
                        ["Customer Contract Code", authorization.customerContractCode || "-"],
                        ["NAICS Code", authorization.naicsCode || "-"],
                        ["IWA JAMIS Project ID", authorization.iwaJamisProjectId || "-"],
                        ["Contract Type", contractTypeLabels[authorization.contractType] || "-"],
                        ["Period", `${formatDate(authorization.periodStart, false)} - ${formatDate(authorization.periodEnd, false)}`]
                    ].map(([label, value], index) => (
                        <Grid key={label} size={{ xs: 12, sm: 6 }}>
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                            <Typography fontWeight={500}>{value}</Typography>
                        </Grid>
                    ))}
                </Grid>
            </SummaryCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
            <SummaryCard title="Entities / Organization" height="100%">
                <Grid container spacing={1.25}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">Entity A (Donor)</Typography>
                        <Typography fontWeight={500}>{authorization.donorEntity || authorization.donorEntityAbbr || "-"}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">Entity B (Receives Services)</Typography>
                        <Typography fontWeight={500}>{authorization.receivingEntity || authorization.receivingEntityAbbr || "-"}</Typography>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">OG</Typography>
                        <Typography fontWeight={500}>{authorization.og || "-"}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">LOB</Typography>
                        <Typography fontWeight={500}>{authorization.lob || "-"}</Typography>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">Entity A GM</Typography>
                        <Typography fontWeight={500}>{authorization.donorGm?.Title || "-"}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">Entity B GM</Typography>
                        <Typography fontWeight={500}>{authorization.receivingGm?.Title || "-"}</Typography>
                    </Grid>
                </Grid>
            </SummaryCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
            <SummaryCard title="Contacts" height="100%">
                <Grid container spacing={1.25}>
                    {[
                        ["Submitter", authorization.Author?.Title || "-"],
                        ["Backup Requestor", authorization.backupRequestor?.Title || "-"],
                        ["Latest Mod Submitter", latestMod?.Author?.Title || "-"],
                        ["Project Manager", authorization.pm?.Title || "-"]
                    ].map(([label, value]) => (
                        <Grid key={label} size={{ xs: 12, sm: 6 }}>
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                            <Typography fontWeight={500}>{value}</Typography>
                        </Grid>
                    ))}
                </Grid>
            </SummaryCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
            <SummaryCard title="Cost Summary" height="100%">
                <Grid container spacing={1.25}>
                    {[
                        ["Base Labor", authorization.baseLaborAmount],
                        ["Base Travel/ODC", authorization.baseTravelAmount],
                        ["Base Grand Total", authorization.baseGrandTotal],
                        ["Approved Labor", authorization.approvedLaborAmount],
                        ["Approved Travel/ODC", authorization.approvedTravelAmount],
                        ["Approved Grand Total", authorization.approvedGrandTotal]
                    ].map(([label, value]) => (
                        <Grid key={String(label)} size={{ xs: 6, sm: 4 }}>
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                            <Typography fontWeight={600}>{canViewFinancials ? formatCurrency(Number(value ?? 0)) : maskedCurrencyText}</Typography>
                        </Grid>
                    ))}
                </Grid>
            </SummaryCard>
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
            <SummaryCard title="Scope of Work">
                <Typography color="text.secondary">{authorization.scopeOfWork || "-"}</Typography>
            </SummaryCard>
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
            <SummaryCard title="Justification">
                <Typography color="text.secondary">{authorization.justification || "-"}</Typography>
            </SummaryCard>
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
            <SummaryCard title="Notes" height="100%">
                <Typography color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>{authorization.notes || "-"}</Typography>
            </SummaryCard>
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
            <SummaryCard title="Attachments" height="100%">
                {attachments.length === 0 ? (
                    <Typography color="text.secondary">No attachments found.</Typography>
                ) : (
                    <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                        {attachments.map((attachment) => (
                            <Link
                                key={attachment.FileName}
                                href={buildAttachmentUrl(attachment)}
                                target="_blank"
                                rel="noopener noreferrer"
                                underline="hover"
                                sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
                            >
                                {getAttachmentIcon(attachment.FileName)}
                                {attachment.FileName}
                            </Link>
                        ))}
                    </Stack>
                )}
            </SummaryCard>
        </Grid>
    </Grid>
);
