import { IContractItem, IInvoiceItem } from "./props";

export const indirectContract: IContractItem = {
  Id: 99999,
  Title: "Indirects",
  field_19: "940000", // Contract ID (e.g. 100158)
  field_20: "Indirects", // Contract Title
  field_35: "INDIRECTJOBS", // Customer Contract Code (e.g. 19AQMM21D0121)
  field_21: "", // Manager 1 Email (Project Manager)
  field_23: "", // Manager 1 Name (Project Manager)
  field_73: "XXXXXX", // NAICS Code (e.g. 541519)
  field_75: "Koniag Government Services" // OG
}

export const indirectInvoice: IInvoiceItem = {
  Id: 99999,
  Title: "Indirects",
  field_49: "940000", // Contract ID (e.g. 100158)
  field_28: "INDIRECTJOBS", // Customer Contract Code (e.g. 19AQMM21D0121)
  field_14: "0001", // Invoice ID 1 (e.g. 0003, 0001)
  InvoiceID1: "940000-0001", // "ContractID-InvoiceID" (e.g. 100158-0001, 100158-0003, 100158-HIS1)
  field_42: "Indirects" // Invoice Title (e.g. "DOS 3451 OP4 OBO ASMB")
}