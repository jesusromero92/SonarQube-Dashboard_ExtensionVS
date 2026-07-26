import * as vscode from 'vscode';
import {
  DASHBOARD_CONFIGURATION_KEYS,
  DASHBOARD_CONFIGURATION_SECTION,
  DASHBOARD_COMMANDS
} from './constants';
import { getDashboardLanguage } from './i18n';
import { RefreshSummary } from './types';

interface NotificationSnapshot {
  issueKeys: string[];
  criticalKeys: string[];
  hotspotKeys: string[];
  total: number;
  qualityGate: string;
}

const SNAPSHOT_KEY = 'sonarQubeDashboard.notificationSnapshot.v1';

export class NotificationManager {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async evaluate(summary: RefreshSummary, source: 'sync' | 'analysis' = 'sync'): Promise<void> {
    const configuration = vscode.workspace.getConfiguration(DASHBOARD_CONFIGURATION_SECTION);
    if (!configuration.get<boolean>(DASHBOARD_CONFIGURATION_KEYS.notificationsEnabled, true)) {
      return;
    }
    const next = this.snapshot(summary);
    const previous = this.context.workspaceState.get<NotificationSnapshot>(SNAPSHOT_KEY);
    await this.context.workspaceState.update(SNAPSHOT_KEY, next);
    if (!previous || summary.configuredFolders === 0 || summary.errors.length > 0) {
      return;
    }

    const spanish = getDashboardLanguage() === 'es';
    const newCritical = next.criticalKeys.filter(key => !previous.criticalKeys.includes(key));
    const newHotspots = next.hotspotKeys.filter(key => !previous.hotspotKeys.includes(key));
    const percent = configuration.get<number>(
      DASHBOARD_CONFIGURATION_KEYS.significantIncreasePercent,
      20
    );
    const minimum = configuration.get<number>(
      DASHBOARD_CONFIGURATION_KEYS.significantIncreaseMinimum,
      5
    );
    const increase = next.total - previous.total;
    const significant = increase >= minimum && (
      previous.total === 0 || increase / Math.max(1, previous.total) * 100 >= percent
    );
    const qualityGateFailed = previous.qualityGate === 'OK' &&
      ['WARN', 'ERROR'].includes(next.qualityGate);

    if (newCritical.length > 0) {
      await this.notify(
        spanish
          ? `${newCritical.length} nuevo(s) defecto(s) Blocker/Critical detectado(s).`
          : `${newCritical.length} new Blocker/Critical issue(s) detected.`,
        true
      );
    }
    if (qualityGateFailed) {
      await this.notify(
        spanish
          ? `El Quality Gate ha pasado de OK a ${next.qualityGate}.`
          : `The Quality Gate changed from OK to ${next.qualityGate}.`,
        true
      );
    }
    if (significant) {
      await this.notify(
        spanish
          ? `Los defectos han aumentado en ${increase} (${previous.total} → ${next.total}).`
          : `Issues increased by ${increase} (${previous.total} → ${next.total}).`,
        true
      );
    }
    if (newHotspots.length > 0) {
      await this.notify(
        spanish
          ? `${newHotspots.length} nuevo(s) Security Hotspot(s) detectado(s).`
          : `${newHotspots.length} new Security Hotspot(s) detected.`,
        false
      );
    }
    if (source === 'analysis') {
      await this.notify(
        spanish
          ? 'El análisis ha terminado y el dashboard se ha actualizado.'
          : 'The analysis finished and the dashboard was refreshed.',
        false
      );
    }
  }

  private snapshot(summary: RefreshSummary): NotificationSnapshot {
    return {
      issueKeys: summary.issues.map(issue => issue.key),
      criticalKeys: summary.issues
        .filter(issue => ['BLOCKER', 'CRITICAL', 'HIGH'].includes(issue.severity.toUpperCase()))
        .map(issue => issue.key),
      hotspotKeys: summary.hotspots.map(hotspot => hotspot.key),
      total: summary.published,
      qualityGate: summary.qualityGate.status
    };
  }

  private async notify(message: string, warning: boolean): Promise<void> {
    const action = getDashboardLanguage() === 'es' ? 'Abrir dashboard' : 'Open dashboard';
    const selected = warning
      ? await vscode.window.showWarningMessage(message, action)
      : await vscode.window.showInformationMessage(message, action);
    if (selected === action) {
      await vscode.commands.executeCommand(DASHBOARD_COMMANDS.open);
    }
  }
}
