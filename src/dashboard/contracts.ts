import { RefreshSummary } from '../types';

export type RefreshCallback = () => Promise<RefreshSummary>;
export type ClearCallback = () => void;
export type DashboardPage = 'data' | 'configuration';

export interface DashboardWebviewMessage {
  type?: string;
  folderUri?: string;
  serverUrl?: string;
  token?: string;
  projectKey?: string;
  branch?: string;
  baseDir?: string;
  fileUri?: string;
  line?: number;
  page?: DashboardPage;
  hotspotKey?: string;
}
