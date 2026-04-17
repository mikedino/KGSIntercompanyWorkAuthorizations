import { ContextInfo, Helper } from "gd-sprest";
import { WebPartContext } from '@microsoft/sp-webpart-base';

// Sets the context information
export const setContext = (context: WebPartContext): void => {
    // Set the context
    ContextInfo.setPageContext(context.pageContext);

    // Load SP Core libraries
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    Helper.loadSPCore().then(() => {
        // Update the source url
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        Strings.Sites.main.url = ContextInfo.webAbsoluteUrl;
    })
}

/** Global Constants **/
/** must come after setContext despite warnings or else the blanks will not
 * be set before they are used.
 */
const Strings = {
    ProjectName: "Intercompany Work Authorization (IWA)",
    Sites: {
        main: {
            url: ContextInfo.webAbsoluteUrl,
            lists: {
                Authorizations: "IWAAgreements",
                LaborLine: "IWALaborLine",
                Mods: "IWAMods",
                Resources: "IWAResources",
                TravelODC: "IWATravelODC",
                WorkflowRuns: "IWAWorkflowRuns",
                WorkflowActions: "IWAWorkflowActions",
                Users: "IWAAppUsers",
                Counters: "IWACounters"
            }
        },
        jamis: {
            url: "/sites/Jamis_Data_API",
            lists: {
                ContractEP: "ContractEndPoint",
                InvoiceEP: "InvoiceEndPoint",
                JobEP: "JobEndPoint"
            }
        },
        lookups: {
            url: "/sites/Dev-Sandbox",
            lists: {
                Config: "Config",
                Entities: "Entities",
                OGs: "OGPresidents",
                LOBs: "LOB"
            }
        }
    },
    Colors: {
        BlueFill: "#D4E7F6",
        BlueColor: "#0068B8",
        RedFill: "#FABBC3",
        RedColor: "#A30E15",
        GreenFill: "#CAF0CC",
        GreenColor: "#437406",
        GrayFill: "#f3f2f1",
        GrayColor: "#605e5c",
        PurpleFill: "#C3CAF9",
        PurpleColor: "#183EE7",
        YellowFill: "#FFEBC0",
        YellowColor: "#8F6200",
        LilacFill: "#E5D2E3",
        LilacColor: "#86417B",
        SageFill: "#CAEEE9",
        SageColor: "#007564",
        SPOTealColor: "#03787C",
        SPOBlueColor: "#0078D4",
        ErrorMessageRed: "#a4262c",
        Merlot: "#981b1e",
        Tarawera: "#0a314d",
        BlackPearl: "#0a2240",
        Smalt: "#002d74",
        Matisse: "#205493"
    },
    Version: "1.0.0.1"
};

export default Strings;