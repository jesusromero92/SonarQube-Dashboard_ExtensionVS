import { DashboardLanguage } from '../i18n';
import {
  IssueMutationKind,
  RefreshSummary,
  ScannerMode,
  SonarCreatableComponentKind,
  SonarCreationCapabilities
} from '../types';

export type RefreshCallback = (source?: 'sync' | 'analysis') => Promise<RefreshSummary>;
export type ClearCallback = () => void;
export type DashboardPage = 'data' | 'configuration';

export interface DashboardWebviewMessage {
  type?: string;
  folderUri?: string;
  serverUrl?: string;
  token?: string;
  projectKey?: string;
  projectName?: string;
  branch?: string;
  baseDir?: string;
  scannerMode?: ScannerMode;
  buildCommand?: string;
  customScannerCommand?: string;
  language?: DashboardLanguage;
  fileUri?: string;
  line?: number;
  page?: DashboardPage;
  scope?: 'overall' | 'newCode';
  hotspotKey?: string;
  issueKey?: string;
  ruleKey?: string;
  mutationKind?: IssueMutationKind;
  transition?: string;
  assignee?: string;
  comment?: string;
  flowIndex?: number;
  locationIndex?: number;
  groupIndex?: number;
  notificationsEnabled?: boolean;
  significantIncreasePercent?: number;
  significantIncreaseMinimum?: number;
  componentKind?: SonarCreatableComponentKind;
  componentKey?: string;
  componentName?: string;
  componentDescription?: string;
  componentVisibility?: 'private' | 'public';
  creationCapabilities?: SonarCreationCapabilities;
}
