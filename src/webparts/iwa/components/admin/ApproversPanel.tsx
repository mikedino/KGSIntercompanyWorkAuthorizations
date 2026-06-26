import * as React from "react";
import { useMemo, useState, useEffect } from "react";
import { WebPartContext } from "@microsoft/sp-webpart-base";
import {
  Alert, Box, Divider, Grid, IconButton, InputAdornment, Paper, Stack, Tab, Tabs,
  TextField, Typography, useMediaQuery
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import { formatError } from "../common/utils";
import { IConfigItem, IEntityItem, ILobItem, IOgItem, IPeoplePicker } from "../data/props";
import { useTheme } from "@mui/material/styles";
import { IPersonaProps } from "@fluentui/react/lib/Persona";
import { LobDefaultsSection } from "./LobPanel";
import { OgDefaultsSection } from "./OgPanel";
import { CompanyDefaultsSection } from "./CompanyPanel";
import { EntityDefaultsSection } from "./EntityPanel";
import { LobService } from "./lobService";
import { EntityService } from "./entityService";
import { IOgPayload, OgService } from "./ogService";
import { ConfigService } from "./configService";
import { AdminLookupWriteService } from "./adminLookupWriteService";

type ApproverSection = "company" | "lobs" | "ogs" | "entities";
type BusyRunner = <T, >(message: string, fn: () => Promise<T>) => Promise<T>;
type FieldErrorMap = Record<string, string>;
export type OgField = "president" | "cm";
export type ConfigKey = "config-hr" | "config-cfo";

interface ApproversAdminPanelProps {
  context: WebPartContext;
  config: IConfigItem[];
  lobs: ILobItem[];
  ogs: IOgItem[];
  entities: IEntityItem[];
  runBusy: BusyRunner;
  onSaved: () => Promise<void>; // refresh snapshot in parent
  onSuccess: (message: string) => void;
}

export type PeoplePickerContext = {
  absoluteUrl: string;
  msGraphClientFactory: WebPartContext["msGraphClientFactory"];
  spHttpClient: WebPartContext["spHttpClient"];
};

export const toPickerValue = (person?: IPeoplePicker): string[] => {
  const email = person?.EMail;
  return email ? [email] : [];
};

export const firstOrUndefined = (items: IPersonaProps[], selectionLimit: number): IPersonaProps | undefined => {
  if (!items?.length) return undefined;
  return selectionLimit === 1 ? items[0] : items[0];
};

// Helper to safely run async from event handlers without `void`
export const run = (p: Promise<void>): void => {
  p.catch((err) => console.error(err));
};

/* ------------------------- Main Panel ------------------------- */
export const ApproversAdminPanel: React.FC<ApproversAdminPanelProps> = ({
  context,
  config,
  lobs,
  ogs,
  entities,
  runBusy,
  onSaved,
  onSuccess
}) => {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("md"));

  const [error, setError] = useState<string>("");
  const [savingKey, setSavingKey] = useState<string>("");
  const [filter, setFilter] = useState<string>("");
  const [section, setSection] = useState<ApproverSection>("company");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const hr = useMemo(() => config.find((item: IConfigItem) => item.IsFor === "HR"), [config]);
  const cfo = useMemo(() => config.find((item: IConfigItem) => item.IsFor === "CFO"), [config]);

  const peoplePickerContext: PeoplePickerContext = {
    absoluteUrl: AdminLookupWriteService.lookupsAbsoluteUrl,
    msGraphClientFactory: context.msGraphClientFactory,
    spHttpClient: context.spHttpClient
  };

  /****************************** VALIDATION **********************************/
  const upsertFieldErrors = (
    prev: FieldErrorMap,
    checks: Array<{ key: string; valid: boolean; message: string }>
  ): FieldErrorMap => {
    const next: FieldErrorMap = { ...prev };

    for (const c of checks) {
      if (!c.valid) next[c.key] = c.message;
      else delete next[c.key];
    }

    return next;
  };

  const hasPerson = (p?: { Id?: number; EMail?: string; Title?: string } | null): boolean => {
    // check email and ID
    const idOk = typeof p?.Id === "number" && p.Id > 0;
    const emailOk = typeof p?.EMail === "string" && p.EMail.trim().length > 0;

    return idOk && emailOk;
  };

  const clearFieldError = (key: string): void => {
    setFieldErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const setFieldError = (key: string, msg: string): void => {
    setFieldErrors(prev => ({ ...prev, [key]: msg }));
  };

  // validation for Company
  useEffect(() => {
    setFieldErrors(prev =>
      upsertFieldErrors(prev, [
        {
          key: "config-hr",
          valid: hasPerson(hr?.User),
          message: "HR is required."
        },
        {
          key: "config-cfo",
          valid: hasPerson(cfo?.User),
          message: "CFO is required."
        }
      ])
    );
  }, [cfo?.User?.Id, hr?.User?.Id]);

  // validation for LOBs
  useEffect(() => {
    const checks = lobs.map(lob => ({
      key: `lob-${lob.Id}-coo`,
      valid: hasPerson(lob.coo),
      message: `COO is required for ${lob.Title}.`
    }));

    setFieldErrors(prev => upsertFieldErrors(prev, checks));
  }, [lobs]);

  // validation for OGs
  const ogSig = React.useMemo(() => { //use a stable signature for OG array ref
    return ogs
      .map(o => `${o.Id}:${o.president?.Id ?? 0}:${o.CM?.Id ?? 0}`)
      .join("|");
  }, [ogs]);
  useEffect(() => {
    const checks = ogs.flatMap(og => ([
      {
        key: `og-${og.Id}-president`,
        valid: hasPerson(og.president),
        message: `OG President is required for ${og.Title}.`
      },
      {
        key: `og-${og.Id}-cm`,
        valid: hasPerson(og.CM),
        message: `Contract Manager is required for ${og.Title}.`
      }
    ]));

    setFieldErrors(prev => upsertFieldErrors(prev, checks));
  }, [ogSig]);

  // validation for Entity
  useEffect(() => {
    const checks = entities.map(ent => ({
      key: `entity-${ent.Id}-gm`,
      valid: hasPerson(ent.GM),
      message: `GM is required for ${ent.abbr || ent.Title}.`
    }));

    setFieldErrors(prev => upsertFieldErrors(prev, checks));
  }, [entities]);


  const filteredLobs = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return lobs;
    return lobs.filter(l => (l.Title ?? "").toLowerCase().includes(q));
  }, [lobs, filter]);

  const filteredOgs = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return ogs;
    return ogs.filter(o => (o.Title ?? "").toLowerCase().includes(q));
  }, [ogs, filter]);

  const filteredEntities = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return entities;
    return entities.filter(e => ((e.combinedTitle ?? e.Title ?? "")).toLowerCase().includes(q));
  }, [entities, filter]);


  const save = async (key: string, message: string, label: string, fn: () => Promise<void>): Promise<void> => {
    setError("");
    setSavingKey(key);

    try {
      await runBusy(message, async () => {
        await fn();
        await onSaved();
      });

      onSuccess(`${label} updated successfully`);
    } catch (e) {
      console.log(`Error saving ${label}`, e);
      setError(formatError(e));
    } finally {
      setSavingKey("");
    }
  };

  /********************  Save for CONFIG > HR or CFO *********************************/
  const handleSaveConfigPerson = async (
    key: ConfigKey,
    label: string,
    configItem?: IConfigItem,
    person?: IPersonaProps
  ): Promise<void> => {
    if (!configItem?.Id) {
      setError("Config item was not found. Please verify the Config list has the required rows.");
      return;
    }

    const personId = Number(person?.id);
    if (!personId || Number.isNaN(personId)) {
      setFieldError(key, `${label} is required.`);
      return; // don't save blanks !!!
    }

    clearFieldError(key);

    await save(key, `Saving ${label}…`, label, async () => {
      await ConfigService.updateConfigApprover(configItem.Id, personId);
    });
  };

  /********************  Save for LOB > COO *********************************/
  const handleSaveLobCoo = async (lobId: number, lobTitle: string, label: string, person?: IPersonaProps): Promise<void> => {
    const errKey = `lob-${lobId}-coo`;
    const personId = Number(person?.id);

    if (!personId || Number.isNaN(personId)) {
      setFieldError(errKey, `COO is required for ${lobTitle}.`);
      return;
    }

    clearFieldError(errKey);

    await save(`lob-${lobId}`, `Saving COO for ${lobTitle}…`, label, async () => {
      await LobService.updateCoo(lobId, personId);
    });
  };

  const handleSaveLobTitle = async (lobId: number, currentTitle: string, nextTitle: string): Promise<void> => {
    const trimmed = nextTitle.trim();

    if (!trimmed) {
      setError("LOB title is required.");
      return;
    }

    await save(`lob-${lobId}`, `Saving ${currentTitle} title…`, `${currentTitle} title`, async () => {
      await LobService.updateTitle(lobId, trimmed);
    });
  };

  const handleCreateLob = async (title: string, cooId?: number): Promise<void> => {
    const trimmed = title.trim();

    if (!trimmed) {
      setError("LOB title is required.");
      return;
    }

    await save("lob-create", `Creating ${trimmed}…`, trimmed, async () => {
      await LobService.create(trimmed, cooId);
    });
  };

  const handleDeleteLob = async (lobId: number, lobTitle: string): Promise<void> => {
    await save(`lob-${lobId}`, `Deleting ${lobTitle}…`, lobTitle, async () => {
      await LobService.delete(lobId);
    });
  };

  /********************  Save for OG > President or CM *********************************/
  const handleSaveOgPerson = async (
    ogId: number,
    ogTitle: string,
    label: string,
    changedField: OgField,
    presidentId?: number,
    cmId?: number
  ): Promise<void> => {

    const presKey = `og-${ogId}-president`;
    const cmKey = `og-${ogId}-cm`;

    // validate ONLY the field the user touched
    if (changedField === "president") {
      if (!presidentId || Number.isNaN(presidentId)) {
        setFieldError(presKey, `OG President is required for ${ogTitle}.`);
        return;
      }
      clearFieldError(presKey);
    }

    if (changedField === "cm") {
      if (!cmId || Number.isNaN(cmId)) {
        setFieldError(cmKey, `Contract Manager is required for ${ogTitle}.`);
        return;
      }
      clearFieldError(cmKey);
    }

    // still must send BOTH ids for updateOgApprovers
    // so use existing values for the "other" field
    await save(`og-${ogId}`, `Saving approvers for ${ogTitle}…`, label, async () => {
      await OgService.updateApprovers(ogId, presidentId, cmId);
    });
  };

  const handleUpdateOg = async (item: IOgPayload): Promise<void> => {
    await save(`og-${item.Id}`, `Saving ${item.Title} title…`, `${item.Title} title`, async () => {
      await OgService.update(item);
    });
  };

  const handleCreateOg = async (item: IOgPayload): Promise<void> => {
    await save("og-create", `Creating ${item.Title}…`, item.Title, async () => {
      await OgService.create(item);
    });
  };

  const handleDeleteOg = async (ogId: number, ogTitle: string): Promise<void> => {
    await save(`og-${ogId}`, `Deleting ${ogTitle}…`, ogTitle, async () => {
      await OgService.delete(ogId);
    });
  };

  /******************** Save for ENITY > GM **************************/
  const handleSaveEntityGm = async (entityId: number, entityTitle: string, label: string, person?: IPersonaProps): Promise<void> => {
    const errKey = `entity-${entityId}-gm`;
    const personId = Number(person?.id);

    if (!personId || Number.isNaN(personId)) {
      setFieldError(errKey, `GM is required for ${entityTitle}.`);
      return;
    }

    clearFieldError(errKey);

    await save(`entity-${entityId}`, `Saving GM for ${entityTitle}…`, label, async () => {
      await EntityService.updateGm(entityId, Number(person?.id) ?? undefined);
    });
  };


  const handleSaveEntityTitle = async (entityId: number, abbr: string, currentTitle: string, nextTitle: string): Promise<void> => {
    const trimmed = nextTitle.trim();

    if (!trimmed) {
      setError("Entity title is required.");
      return;
    }

    await save(`lob-${entityId}`, `Saving ${currentTitle} title…`, `${currentTitle} title`, async () => {
      await EntityService.updateTitle(entityId, abbr, trimmed);
    });
  };

  const handleCreateEntity = async (title: string, abbr: string, gmId?: number): Promise<void> => {
    const trimmed = title.trim();

    if (!trimmed) {
      setError("Entity title is required.");
      return;
    }

    await save("entity-create", `Creating ${trimmed}…`, trimmed, async () => {
      await EntityService.create(trimmed, abbr, gmId);
    });
  };

  const handleDeleteEntity = async (entityId: number, entityTitle: string): Promise<void> => {
    await save(`lob-${entityId}`, `Deleting ${entityTitle}…`, entityTitle, async () => {
      await EntityService.delete(entityId);
    });
  };

  //////////////////////////////// end handlers /////////////

  const showFilter = section !== "company";
  const filterLabel =
    section === "lobs" ? "Filter LOBs" :
      section === "ogs" ? "Filter OGs" :
        "Filter Entities";

  return (
    <Stack spacing={2} sx={{ width: "100%", minWidth: 0 }}>
      {error && <Alert severity="error">{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" fontWeight={700}>Default Approvers</Typography>
        <Typography variant="body2" color="text.secondary">
          Edit defaults where they are stored (Config / LOB / OG / Entities)
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Grid container spacing={2} sx={{ minWidth: 0 }}>
          <Grid size={{ xs: 12, md: 3, xl: 2 }} >
            <Tabs
              orientation={isSmall ? "horizontal" : "vertical"}
              value={section}
              onChange={(_, v) => setSection(v as ApproverSection)}
              variant={isSmall ? "scrollable" : "standard"}
              allowScrollButtonsMobile
              sx={(theme) => ({
                borderRight: !isSmall ? 1 : 0,
                borderColor: "divider",

                // Indicator color
                "& .MuiTabs-indicator": {
                  backgroundColor: theme.palette.action.active,
                  width: "3px"
                },

                // Default tab color
                "& .MuiTab-root": {
                  //color: theme.palette.text.secondary,
                  alignItems: "flex-start",
                  justifyContent: "flex-start",
                  textAlign: "left"
                },

                // Selected tab color
                "& .Mui-selected": {
                  color: theme.palette.action.active
                },

                // Important: inner wrapper alignment fix
                "& .MuiTab-root .MuiTab-wrapper": {
                  alignItems: "flex-start",
                  textAlign: "left",
                  width: "100%"
                }
              })}
            >
              <Tab value="company" label="Company" />
              <Tab value="lobs" label="LOBs" />
              <Tab value="ogs" label="Operating Groups" />
              <Tab value="entities" label="Entities" />
            </Tabs>
          </Grid>

          <Grid size={{ xs: 12, md: 9, xl: 10 }} sx={{ minWidth: 0 }}>
            {showFilter && (
              <Box sx={{ mb: 2, minWidth: 0 }}>
                <TextField
                  size="small"
                  placeholder="Type to filter..."
                  fullWidth
                  label={filterLabel}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  sx={{ maxWidth: 350 }}
                  slotProps={{
                    input: {
                      endAdornment: filter ? (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setFilter("")}
                            onMouseDown={(e) => e.preventDefault()} // keeps focus
                            edge="end"
                            aria-label="Clear filter"
                            title="Clear filter"
                            sx={{ color: "text.secondary" }}
                          >
                            <ClearIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ) : undefined
                    }
                  }}
                />
              </Box>
            )}

            {section !== "company" &&
              <Divider sx={{ mb: 2 }} />
            }

            {section === "company" && (
              <CompanyDefaultsSection
                hr={hr}
                cfo={cfo}
                peoplePickerContext={peoplePickerContext}
                savingKey={savingKey}
                errors={fieldErrors}
                clearError={clearFieldError}
                onChangeHr={async (person) => {
                  await handleSaveConfigPerson("config-hr", "HR", hr, person);
                }}
                onChangeCfo={async (person) => {
                  await handleSaveConfigPerson("config-cfo", "CFO", cfo, person);
                }}
              />
            )}

            {section === "lobs" && (
              <LobDefaultsSection
                lobs={filteredLobs}
                peoplePickerContext={peoplePickerContext}
                savingKey={savingKey}
                onChangeCoo={handleSaveLobCoo}
                onEditTitle={handleSaveLobTitle}
                onCreate={handleCreateLob}
                onDelete={handleDeleteLob}
                errors={fieldErrors}
                clearError={clearFieldError}
              />
            )}

            {section === "ogs" && (
              <OgDefaultsSection
                ogs={filteredOgs}
                lobs={lobs}
                peoplePickerContext={peoplePickerContext}
                savingKey={savingKey}
                onChangeOg={handleSaveOgPerson}
                onUpdate={handleUpdateOg}
                onCreate={handleCreateOg}
                onDelete={handleDeleteOg}
                errors={fieldErrors}
                clearError={clearFieldError}
              />
            )}

            {section === "entities" && (
              <EntityDefaultsSection
                entities={filteredEntities}
                peoplePickerContext={peoplePickerContext}
                savingKey={savingKey}
                onEditTitle={handleSaveEntityTitle}
                onCreate={handleCreateEntity}
                onChangeGm={handleSaveEntityGm}
                onDelete={handleDeleteEntity}
                errors={fieldErrors}
                clearError={clearFieldError}
              />
            )}
          </Grid>
        </Grid>
      </Paper>
    </Stack>
  );
};
