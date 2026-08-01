import { DashboardLanguage } from '../i18n';
import { AnalysisExecutionStep } from '../scanner/types';
import {
  IssueMutationKind,
  RefreshSummary,
  ScannerMode,
  SonarCreatableComponentKind,
  SonarCreationCapabilities
} from '../types';

export type RefreshCallback = (source?: 'sync' | 'analysis') => Promise<RefreshSummary>;
export type ClearCallback = () => void;
export type DashboardPage = 'data' | 'configuration' | 'history' | 'diagnostics';

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
  testCommand?: string;
  customScannerCommand?: string;
  preAnalysisCommands?: string;
  postAnalysisCommands?: string;
  runBuild?: boolean;
  runTests?: boolean;
  runPreAnalysisStages?: boolean;
  runPostAnalysisStages?: boolean;
  analysisSteps?: AnalysisExecutionStep[];
  templateName?: string;
  templateDescription?: string;
  templateId?: string;
  executionId?: string;
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
