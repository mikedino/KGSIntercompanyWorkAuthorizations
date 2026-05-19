import * as React from "react";
import { Grid, Link, Paper, Stack, Typography } from "@mui/material";
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

export const IwaSummaryTab: React.FC<IIwaSummaryTabProps> = ({ authorization, attachments, canViewFinancials, latestMod }): JSX.Element => (
    <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
            <Paper variant="outlined" sx={{ p: 1.75, height: "100%" }}>
                <Typography variant="subtitle2" fontWeight={600}>Contract</Typography>
                <Grid container spacing={1.25} sx={{ mt: 0.25 }}>
                    {[
                        ["Contract ID", authorization.contractId || "-"],
                        ["Contract Name", authorization.contractName || "-"],
                        ["Invoice / Task Order", authorization.invoice || "Not specified"],
                        ["Customer Contract Code", authorization.customerContractCode || "-"],
                        ["Period", `${formatDate(authorization.periodStart, false)} - ${formatDate(authorization.periodEnd, false)}`]
                    ].map(([label, value], index) => (
                        <Grid key={label} size={{ xs: 12, sm: index === 4 ? 12 : 6 }}>
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                            <Typography fontWeight={500}>{value}</Typography>
                        </Grid>
                    ))}
                </Grid>
            </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
            <Paper variant="outlined" sx={{ p: 1.75, height: "100%" }}>
                <Typography variant="subtitle2" fontWeight={600}>Entities / Organization</Typography>
                <Grid container spacing={1.25} sx={{ mt: 0.25 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">Entity A (Donor)</Typography>
                        <Typography fontWeight={500}>{authorization.donorEntityAbbr || authorization.donorEntity || "-"}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">Entity B (Receives Services)</Typography>
                        <Typography fontWeight={500}>{authorization.receivingEntityAbbr || authorization.receivingEntity || "-"}</Typography>
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
            </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
            <Paper variant="outlined" sx={{ p: 1.75, height: "100%" }}>
                <Typography variant="subtitle2" fontWeight={600}>Contacts</Typography>
                <Grid container spacing={1.25} sx={{ mt: 0.25 }}>
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
            </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
            <Paper variant="outlined" sx={{ p: 1.75, height: "100%" }}>
                <Typography variant="subtitle2" fontWeight={600}>Cost Summary</Typography>
                <Grid container spacing={1.25} sx={{ mt: 0.25 }}>
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
            </Paper>
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>Scope of Work</Typography>
                <Typography color="text.secondary">{authorization.scopeOfWork || "-"}</Typography>
            </Paper>
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>Justification</Typography>
                <Typography color="text.secondary">{authorization.justification || "-"}</Typography>
            </Paper>
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
            <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                <Typography variant="subtitle2" fontWeight={600}>Notes</Typography>
                <Typography color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>{authorization.notes || "-"}</Typography>
            </Paper>
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
            <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                <Typography variant="subtitle2" fontWeight={600}>Attachments</Typography>
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
            </Paper>
        </Grid>
    </Grid>
);
