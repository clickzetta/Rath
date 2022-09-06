import { ISemanticType, IAnalyticType } from 'visual-insights'

export type Aggregator = 'sum' | 'mean' | 'count';
export interface Field {
  name: string;
  type: ISemanticType
}

export interface BIField {
  name: string;
  type: IAnalyticType
}

export type FieldImpurity = [string, number, number, Field];

export type OperatorType = 'sum' | 'mean' | 'count';

export enum IDataSourceType {
  FILE = 'file',
  RESTFUL = 'restful',
  DATABASE = 'database',
  DEMO = 'demo',
  CLICKHOUSE = 'clickhouse',
  LOCAL = 'local',
  AIRTABLE = 'airtable'
}

export const globalRef: {
  baseVisSpec: any
} = {
  baseVisSpec: null
}