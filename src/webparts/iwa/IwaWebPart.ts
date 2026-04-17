import * as React from 'react';
import * as ReactDom from 'react-dom';
import { HashRouter as Router } from "react-router-dom";
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

import * as strings from 'IwaWebPartStrings';
import { App } from './components/App';
import { IIwaAppProps } from './components/data/props';
import Strings, { setContext } from './components/common/strings';

export interface IIwaWebPartProps {
  description: string;
}

export default class IwaWebPart extends BaseClientSideWebPart<IIwaWebPartProps> {

  public render(): void {

    // set the context
    setContext(this.context);

    const appElement: React.ReactElement<IIwaAppProps> = React.createElement(
      App,
      {
        description: this.properties.description,
        context: this.context
      }
    );

    // install Router on parent to use throughout
    const routerElement = React.createElement(
      Router,
      null,
      appElement
    )

    ReactDom.render(routerElement, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: `Application version: v${Strings.Version}`
          },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneTextField('description', {
                  label: strings.DescriptionFieldLabel
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
