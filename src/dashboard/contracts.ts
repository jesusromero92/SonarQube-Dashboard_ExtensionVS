import type { DashboardLanguage } from '../i18n';
import type {
  IssueMutationKind,
  RefreshSummary,
  SonarCreatableComponentKind,
  SonarCreationCapabilities
} from '../types';

export type RefreshCallback = (source?: 'sync' | 'analysis') => Promise<RefreshSummary>;
export type ClearCallback = () => void;
export type DashboardPage = 'data' | 'configuration' | 'diagnostics' | (string & {});

/**
 * Core dashboard message contract.
 *
 * Optional modules own their specific message payloads and are routed through
 * DashboardModulesRuntime without importing module types into the core.
 */
export interface DashboardWebviewMessage {
  type?: string;
  folderUri?: string;
  serverUrl?: string;
  token?: string;
  projectKey?: string;
  projectName?: string;
  branch?: string;
  baseDir?: string;
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
  clipboardText?: string;
  flowIndex?: number;
  locationIndex?: number;
  groupIndex?: number;
  notificationsEnabled?: boolean;
  moduleId?: string;
  moduleEnabled?: boolean;
  significantIncreasePercent?: number;
  significantIncreaseMinimum?: number;
  componentKind?: SonarCreatableComponentKind;
  componentKey?: string;
  componentName?: string;
  componentDescription?: string;
  componentVisibility?: 'private' | 'public';
  creationCapabilities?: SonarCreationCapabilities;
  [key: string]: unknown;
}
