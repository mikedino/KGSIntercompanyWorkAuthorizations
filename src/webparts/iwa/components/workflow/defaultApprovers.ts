import { IAuthorizationItem } from "../data/props";
import { DataSource } from "../data/ds";

export interface IDefaultApprovers {
  OGPresidentId?: number;
  hrId?: number;
  cfoId?: number;
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
      cfoId: DataSource.CFO?.Id
    };
  }
}
