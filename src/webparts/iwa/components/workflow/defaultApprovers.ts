import { IAuthorizationItem, IPeoplePicker } from "../data/props";
import { DataSource } from "../data/ds";

export interface IDefaultApprovers {
  OGPresidentId?: number;
  hrId?: number;
  cfoId?: number;
  ogPresident?: IPeoplePicker;
  hr?: IPeoplePicker;
  cfo?: IPeoplePicker;
}

export class ApproverResolver {

  static async resolve(item: IAuthorizationItem): Promise<IDefaultApprovers> {

    //set OG from form selection
    const OG = DataSource.OGs.find(og => og.Title === item.og);

    //set OG Pres
    const OGPresidentId = OG?.president.Id;

    return {
      OGPresidentId,
      hrId: DataSource.HR?.Id,
      cfoId: DataSource.CFO?.Id,
      // Keep the full person objects so the workflow service can resolve them
      // against the workflow-run site collection. The Ids from lookup/config
      // lists are only valid in the site collection where those lists live.
      ogPresident: OG?.president,
      hr: DataSource.HR,
      cfo: DataSource.CFO
    };
  }
}
