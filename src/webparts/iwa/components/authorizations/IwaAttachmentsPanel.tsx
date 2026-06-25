import * as React from "react";
import {
    Button,
    Divider,
    List,
    ListItem,
    ListItemText,
    Paper,
    Stack,
    Typography
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";

export interface IAttachmentItem {
    FileName: string;
    ServerRelativeUrl?: string;
}

export interface IIwaAttachmentsPanelProps {
    attachments: IAttachmentItem[];
    onRemoveAttachment: (fileName: string) => Promise<void>;
    onUploadAttachment: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export const IwaAttachmentsPanel: React.FC<IIwaAttachmentsPanelProps> = ({
    attachments,
    onRemoveAttachment,
    onUploadAttachment
}): JSX.Element => {
    return (
        <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2}>
                <Stack spacing={0.5}>
                    <Typography variant="h6" fontWeight={700}>
                        Attachments
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Keep supporting files on the draft header so reviewers and the later detail editors stay aligned to one authorization record.
                    </Typography>
                </Stack>

                <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
                    <Button
                        variant="outlined"
                        component="label"
                        startIcon={<AddOutlinedIcon />}
                        aria-label="Upload attachment"
                        title="Upload attachment"
                        sx={{ alignSelf: { xs: "stretch", md: "flex-start" } }}
                    >
                        Upload Attachment
                        <input hidden type="file" onChange={(event) => {
                            onUploadAttachment(event).catch(() => undefined);
                        }} />
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                        {attachments.length} file(s) attached
                    </Typography>
                </Stack>

                <Divider />

                {attachments.length === 0 ? (
                    <Stack direction="row" spacing={1.25} alignItems="center">
                        <AttachFileOutlinedIcon color="disabled" />
                        <Typography variant="body2" color="text.secondary">
                            No attachments have been added yet.
                        </Typography>
                    </Stack>
                ) : (
                    <List disablePadding>
                        {attachments.map((attachment: IAttachmentItem): JSX.Element => (
                            <ListItem
                                key={attachment.FileName}
                                disableGutters
                                secondaryAction={(
                                    <Button
                                        size="small"
                                        color="error"
                                        startIcon={<DeleteOutlineOutlinedIcon />}
                                        aria-label={`Remove attachment ${attachment.FileName}`}
                                        title={`Remove attachment ${attachment.FileName}`}
                                        onClick={() => {
                                            onRemoveAttachment(attachment.FileName).catch(() => undefined);
                                        }}
                                    >
                                        Remove
                                    </Button>
                                )}
                            >
                                <ListItemText
                                    primary={attachment.FileName}
                                    secondary={attachment.ServerRelativeUrl ?? "Attached to current draft"}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </Stack>
        </Paper>
    );
};
