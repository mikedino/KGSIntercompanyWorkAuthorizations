import * as React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatCurrency, formatDate } from "../../common/utils";
import { IInvoiceItem } from "../../data/props";
import { formatExportModLabel, hasLaborSummaryAmount, hasTravelSummaryAmount, IIwaExportSummaryRow, IIwaExportViewModel } from "./exportViewModel";

interface IIwaExportPdfDocumentProps {
    model: IIwaExportViewModel;
    taskOrder?: IInvoiceItem;
}

const styles = StyleSheet.create({
    page: {
        paddingTop: 98,
        paddingRight: 24,
        paddingBottom: 34,
        paddingLeft: 24,
        fontFamily: "Helvetica",
        fontSize: 8,
        color: "#172333"
    },
    header: {
        position: "absolute",
        top: 24,
        left: 24,
        right: 24,
        borderBottom: "2 solid #0b3554",
        paddingBottom: 6
    },
    headerTitleRow: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center"
    },
    headerSubtitleRow: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 3
    },
    eyebrow: {
        fontSize: 7,
        color: "#00677f",
        textTransform: "uppercase",
        fontFamily: "Helvetica-Bold",
        marginBottom: 3
    },
    title: {
        fontSize: 20,
        color: "#0b3554",
        fontFamily: "Helvetica-Bold"
    },
    subtitle: {
        fontSize: 9,
        color: "#53627a",
        width: "68%"
    },
    badge: {
        border: "1 solid #00677f",
        borderRadius: 10,
        padding: "3 10",
        fontSize: 9,
        color: "#00677f",
        textAlign: "center",
        marginLeft: 10
    },
    approvedText: {
        fontSize: 8,
        color: "#53627a",
        textAlign: "right",
        width: "30%"
    },
    statsRow: {
        display: "flex",
        flexDirection: "row",
        gap: 8,
        marginBottom: 10
    },
    statCard: {
        width: "25%",
        border: "1 solid #cbd6df",
        borderLeft: "4 solid #00799a",
        padding: 8,
        minHeight: 46
    },
    statLabel: {
        fontSize: 7,
        color: "#53627a",
        textTransform: "uppercase",
        fontFamily: "Helvetica-Bold"
    },
    statValue: {
        fontSize: 15,
        color: "#0b3554",
        fontFamily: "Helvetica-Bold",
        marginTop: 4
    },
    statDetail: {
        fontSize: 7,
        color: "#53627a",
        marginTop: 2
    },
    section: {
        border: "1 solid #cbd6df",
        padding: 9,
        marginBottom: 10
    },
    sectionTitle: {
        fontSize: 12,
        color: "#0b3554",
        fontFamily: "Helvetica-Bold",
        marginBottom: 7
    },
    detailGrid: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap"
    },
    detailItem: {
        width: "33.333%",
        marginBottom: 9,
        paddingRight: 8
    },
    detailItemFull: {
        width: "100%",
        marginBottom: 2,
        paddingRight: 8
    },
    detailLabel: {
        fontSize: 7,
        color: "#53627a",
        textTransform: "uppercase",
        fontFamily: "Helvetica-Bold"
    },
    detailValue: {
        fontSize: 9,
        fontFamily: "Helvetica-Bold",
        marginTop: 1
    },
    detailSubtext: {
        fontSize: 7,
        color: "#53627a",
        marginTop: 0
    },
    detailFriendly: {
        fontSize: 9,
        color: "#53627a"
    },
    summaryText: {
        fontSize: 10,
        color: "#00677f",
        lineHeight: 1.35
    },
    periodText: {
        fontSize: 8,
        marginTop: 5
    },
    table: {
        border: "1 solid #dce3e8"
    },
    tableRow: {
        display: "flex",
        flexDirection: "row",
        borderBottom: "1 solid #e6ebef"
    },
    tableHeader: {
        display: "flex",
        flexDirection: "row",
        backgroundColor: "#f2f5f7",
        borderBottom: "1 solid #cbd6df"
    },
    tableTotalRow: {
        display: "flex",
        flexDirection: "row",
        backgroundColor: "#f7f9fa"
    },
    cell: {
        padding: 5
    },
    headerCell: {
        fontSize: 7,
        color: "#53627a",
        textTransform: "uppercase",
        fontFamily: "Helvetica-Bold"
    },
    totalCell: {
        fontFamily: "Helvetica-Bold"
    },
    right: {
        textAlign: "right"
    },
    center: {
        textAlign: "center"
    },
    approvalGrid: {
        display: "flex",
        flexDirection: "row",
        gap: 5
    },
    approvalItem: {
        flexGrow: 1,
        border: "1 solid #d6dde1",
        padding: 6,
        minHeight: 44
    },
    approvalNameSmall: {
        fontSize: 8
    },
    approvalNameTiny: {
        fontSize: 7
    },
    footer: {
        position: "absolute",
        left: 24,
        right: 24,
        bottom: 12,
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        fontSize: 7,
        color: "#53627a",
        borderTop: "1 solid #d6dde1",
        paddingTop: 4
    },
    footerLeft: {
        width: "75%"
    },
    footerRight: {
        width: "25%",
        textAlign: "right"
    }
});

const contractTypeLabel = (value?: string): string => value === "tm" ? "T&M" : value === "ffp" ? "FFP" : value || "-";

const TableCell = ({ children, style = [], width, right = false, center = false }: {
    children: React.ReactNode;
    style?: object | object[];
    width: string;
    right?: boolean;
    center?: boolean;
}): JSX.Element => (
    <Text style={[styles.cell, { width }, right ? styles.right : {}, center ? styles.center : {}, ...(Array.isArray(style) ? style : [style])]}>{children}</Text>
);

export const IwaExportPdfDocument = ({ model, taskOrder }: IIwaExportPdfDocumentProps): JSX.Element => {
    const authorization = model.authorization;
    const exportLabel = model.mod ? formatExportModLabel(model.mod.modNumber) : undefined;
    const headerLabel = exportLabel ?? "BASE";
    const footerLabel = exportLabel ?? "Base IWA";
    const pdfGeneratedOn = model.option.pdfGeneratedOn ?? new Date().toISOString();
    const contractType = contractTypeLabel(authorization.contractType);
    const totalStandardHours = model.laborDetails.reduce((total, row) => total + row.standardHours, 0);
    const totalOvertimeHours = model.laborDetails.reduce((total, row) => total + row.overtimeHours, 0);
    const totalThisLabel = model.mod ? "TOTAL THIS MOD" : "TOTAL BASE";
    const detailItems: Array<{ label: string; value: string; detail: string; fullWidth?: boolean; friendly?: boolean }> = [
        { label: "ENTITY A (DONOR)", value: authorization.donorEntity || "-", detail: authorization.donorEntityAbbr ?? "" },
        { label: "ENTITY B (RECEIVES SERVICES)", value: authorization.receivingEntity || "-", detail: authorization.receivingEntityAbbr ?? "" },
        { label: "OG", value: authorization.og || "-", detail: "" },
        { label: "ENTITY A GM", value: authorization.donorGm?.Title || "-", detail: "" },
        { label: "ENTITY B GM", value: authorization.receivingGm?.Title || "-", detail: "" },
        { label: "LOB", value: authorization.lob || "-", detail: "" },
        { label: "CONTRACT & INVOICE", value: authorization.invoice || taskOrder?.InvoiceID1 || "-", detail: "" },
        { label: "CONTRACT NAME", value: authorization.contractName || "-", detail: "" },
        { label: "PROJECT MANAGER", value: authorization.pm?.Title || "-", detail: "" },
        { label: "NAICS CODE", value: authorization.naicsCode || "-", detail: "" },
        { label: "IWA JAMIS PROJECT ID", value: authorization.iwaJamisProjectId || "-", detail: "" },
        { label: "PERIOD", value: `${formatDate(model.periodStart, false)} - ${formatDate(model.periodEnd, false)}`, detail: "" },
        { label: "SUBMITTED", value: `Submitted by ${model.requestedBy || "-"} on ${formatDate(model.requestedOn, false)}`, detail: "", fullWidth: true, friendly: true }
    ];

    return (
        <Document title={model.title} author="Koniag Intercompany Work Authorization">
            <Page size="LETTER" style={styles.page}>
                <View style={styles.header} fixed>
                    <Text style={styles.eyebrow}>Intercompany Work Authorization</Text>
                    <View style={styles.headerTitleRow}>
                        <Text style={styles.title}>{model.title}</Text>
                        <Text style={styles.badge}>{headerLabel}</Text>
                    </View>
                    <View style={styles.headerSubtitleRow}>
                        <Text style={styles.subtitle}>Entity A: {authorization.donorEntity || "-"} providing services to Entity B: {authorization.receivingEntity || "-"}</Text>
                        <Text style={styles.approvedText}>PDF Generated {formatDate(pdfGeneratedOn, true)}</Text>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    {[
                        ["NEW LABOR", formatCurrency(model.modLaborTotal), `${totalStandardHours} std hrs / ${totalOvertimeHours} OT hrs`],
                        ["NEW TRAVEL", formatCurrency(model.modTravelTotal), `${model.travelDetails.length} line(s)`],
                        [totalThisLabel, formatCurrency(model.modGrandTotal), exportLabel ?? "Base IWA"],
                        ["NEW GRAND TOTAL", formatCurrency(model.newGrandTotal), "Labor + Travel / ODC"]
                    ].map(([label, value, detail]) => (
                        <View key={label} style={styles.statCard}>
                            <Text style={styles.statLabel}>{label}</Text>
                            <Text style={styles.statValue}>{value}</Text>
                            <Text style={styles.statDetail}>{detail}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.section} wrap={false}>
                    <Text style={styles.sectionTitle}>Transaction Header</Text>
                    <View style={styles.detailGrid}>
                        {detailItems.map((item) => (
                            <View key={item.label} style={item.fullWidth ? styles.detailItemFull : styles.detailItem}>
                                {item.friendly ? (
                                    <Text style={styles.detailFriendly}>{item.value}</Text>
                                ) : (
                                    <>
                                        <Text style={styles.detailLabel}>{item.label}</Text>
                                        <Text style={styles.detailValue}>{item.value}</Text>
                                        {!!item.detail && <Text style={styles.detailSubtext}>{item.detail}</Text>}
                                    </>
                                )}
                            </View>
                        ))}
                    </View>
                </View>

                {model.mod && (
                    <View style={styles.section} wrap={false}>
                        <Text style={styles.sectionTitle}>Mod Summary</Text>
                        {model.reason && <Text style={styles.summaryText}>{model.reason}</Text>}
                        {(model.previousPeriodStart || model.previousPeriodEnd) && (
                            <Text style={styles.periodText}>
                                Period changed from {formatDate(model.previousPeriodStart ?? model.periodStart, false)} - {formatDate(model.previousPeriodEnd ?? model.periodEnd, false)} to {formatDate(model.periodStart, false)} - {formatDate(model.periodEnd, false)}.
                            </Text>
                        )}
                    </View>
                )}

                <View style={styles.section} wrap={false}>
                    <Text style={styles.sectionTitle}>Finance Coding Summary</Text>
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <TableCell width="15%" style={styles.headerCell}>Line Type</TableCell>
                            <TableCell width="24%" style={styles.headerCell}>Job ID / CLIN</TableCell>
                            <TableCell width="22%" style={styles.headerCell}>Job Title</TableCell>
                            <TableCell width="13%" style={styles.headerCell} right>Previous</TableCell>
                            <TableCell width="13%" style={styles.headerCell} right>{model.mod ? "This Mod" : "Base"}</TableCell>
                            <TableCell width="13%" style={styles.headerCell} right>New Total</TableCell>
                        </View>
                        {model.rows.flatMap((row: IIwaExportSummaryRow) => {
                            const rows: JSX.Element[] = [];

                            if (hasLaborSummaryAmount(row)) {
                                rows.push(
                                    <View key={`labor-${row.jobId}`} style={styles.tableRow}>
                                        <TableCell width="15%">Labor</TableCell>
                                        <TableCell width="24%">{row.jobId}</TableCell>
                                        <TableCell width="22%">{row.laborJobTitle || "-"}</TableCell>
                                        <TableCell width="13%" right>{formatCurrency(row.previousLabor)}</TableCell>
                                        <TableCell width="13%" right>{formatCurrency(row.modLabor)}</TableCell>
                                        <TableCell width="13%" right>{formatCurrency(row.newLabor)}</TableCell>
                                    </View>
                                );
                            }

                            if (hasTravelSummaryAmount(row)) {
                                rows.push(
                                    <View key={`travel-${row.jobId}`} style={styles.tableRow}>
                                        <TableCell width="15%">Travel / ODC</TableCell>
                                        <TableCell width="24%">{row.jobId}</TableCell>
                                        <TableCell width="22%">{row.travelJobTitle || "-"}</TableCell>
                                        <TableCell width="13%" right>{formatCurrency(row.previousTravel)}</TableCell>
                                        <TableCell width="13%" right>{formatCurrency(row.modTravel)}</TableCell>
                                        <TableCell width="13%" right>{formatCurrency(row.newTravel)}</TableCell>
                                    </View>
                                );
                            }

                            return rows;
                        })}
                        <View style={styles.tableTotalRow}>
                            <TableCell width="61%" style={styles.totalCell}>Grand Total</TableCell>
                            <TableCell width="13%" style={styles.totalCell} right>{formatCurrency(model.previousGrandTotal)}</TableCell>
                            <TableCell width="13%" style={styles.totalCell} right>{formatCurrency(model.modGrandTotal)}</TableCell>
                            <TableCell width="13%" style={styles.totalCell} right>{formatCurrency(model.newGrandTotal)}</TableCell>
                        </View>
                    </View>
                </View>

                <View style={styles.section} wrap={false}>
                    <Text style={styles.sectionTitle}>Labor Detail - {contractType}</Text>
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <TableCell width="17%" style={styles.headerCell}>Employee</TableCell>
                            <TableCell width="12%" style={styles.headerCell}>State</TableCell>
                            <TableCell width="16%" style={styles.headerCell}>Job ID / CLIN</TableCell>
                            <TableCell width="16%" style={styles.headerCell}>Labor Category</TableCell>
                            <TableCell width="5%" style={styles.headerCell} right>STD</TableCell>
                            <TableCell width="8%" style={styles.headerCell} right>STD Rate</TableCell>
                            <TableCell width="4%" style={styles.headerCell} center>STO</TableCell>
                            <TableCell width="5%" style={styles.headerCell} right>OT</TableCell>
                            <TableCell width="8%" style={styles.headerCell} right>OT Rate</TableCell>
                            <TableCell width="9%" style={styles.headerCell} right>Total</TableCell>
                        </View>
                        {model.laborDetails.map((row) => (
                            <View key={`${row.employeeName}-${row.jobId}-${row.laborCategory}`} style={styles.tableRow}>
                                <TableCell width="17%">{row.employeeName}</TableCell>
                                <TableCell width="12%">{row.state}</TableCell>
                                <TableCell width="16%">{row.jobId}</TableCell>
                                <TableCell width="16%">{row.laborCategory}</TableCell>
                                <TableCell width="5%" right>{row.standardHours}</TableCell>
                                <TableCell width="8%" right>{formatCurrency(row.standardRate)}</TableCell>
                                <TableCell width="4%" center>{row.stoHours ? "✓" : "-"}</TableCell>
                                <TableCell width="5%" right>{row.overtimeHours}</TableCell>
                                <TableCell width="8%" right>{formatCurrency(row.overtimeRate)}</TableCell>
                                <TableCell width="9%" right>{formatCurrency(row.totalAmount)}</TableCell>
                            </View>
                        ))}
                        <View style={styles.tableTotalRow}>
                            <TableCell width="61%" style={styles.totalCell}>Labor Totals</TableCell>
                            <TableCell width="5%" style={styles.totalCell} right>{totalStandardHours}</TableCell>
                            <TableCell width="8%" style={styles.totalCell} right>-</TableCell>
                            <TableCell width="4%" style={styles.totalCell} center>-</TableCell>
                            <TableCell width="5%" style={styles.totalCell} right>{totalOvertimeHours}</TableCell>
                            <TableCell width="8%" style={styles.totalCell} right>-</TableCell>
                            <TableCell width="9%" style={styles.totalCell} right>{formatCurrency(model.modLaborTotal)}</TableCell>
                        </View>
                    </View>
                </View>

                <View style={styles.section} wrap={false}>
                    <Text style={styles.sectionTitle}>Travel / ODC Detail</Text>
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <TableCell width="15%" style={styles.headerCell}>Type</TableCell>
                            <TableCell width="25%" style={styles.headerCell}>Job ID / CLIN</TableCell>
                            <TableCell width="42%" style={styles.headerCell}>Description</TableCell>
                            <TableCell width="18%" style={styles.headerCell} right>Amount</TableCell>
                        </View>
                        {model.travelDetails.map((row) => (
                            <View key={`${row.lineType}-${row.jobId}-${row.description}`} style={styles.tableRow}>
                                <TableCell width="15%">{row.lineType}</TableCell>
                                <TableCell width="25%">{row.jobId}</TableCell>
                                <TableCell width="42%">{row.description}</TableCell>
                                <TableCell width="18%" right>{formatCurrency(row.amount)}</TableCell>
                            </View>
                        ))}
                        <View style={styles.tableTotalRow}>
                            <TableCell width="82%" style={styles.totalCell}>Travel / ODC Totals</TableCell>
                            <TableCell width="18%" style={styles.totalCell} right>{formatCurrency(model.modTravelTotal)}</TableCell>
                        </View>
                    </View>
                </View>

                <View style={styles.section} wrap={false}>
                    <Text style={styles.sectionTitle}>Approval Record</Text>
                    <View style={styles.approvalGrid}>
                        {model.approvals.map((row) => (
                            <View key={row.stepKey} style={styles.approvalItem}>
                                <Text style={styles.detailLabel}>{row.label}</Text>
                                <Text
                                    style={[
                                        styles.detailValue,
                                        row.actionBy.length > 30 ? styles.approvalNameTiny : row.actionBy.length > 22 ? styles.approvalNameSmall : {}
                                    ]}
                                >
                                    {row.actionBy}
                                </Text>
                                <Text style={styles.detailSubtext}>{formatDate(row.actionDate, true)}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.footer} fixed>
                    <Text style={styles.footerLeft}>{model.title} - {footerLabel}</Text>
                    <Text
                        style={styles.footerRight}
                        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
                    />
                </View>
            </Page>
        </Document>
    );
};
