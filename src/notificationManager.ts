import * as vscode from 'vscode';
import {
  DASHBOARD_CONFIGURATION_KEYS,
  DASHBOARD_CONFIGURATION_SECTION,
  DASHBOARD_COMMANDS
} from './constants';
import { getDashboardLanguage } from './i18n';
import {
  DashboardHotspot,
  DashboardIssue,
  QualityGateStatus
} from './types';

interface NotificationSnapshot {
  issueKeys: string[];
  criticalKeys: string[];
  hotspotKeys: string[];
  total: number;
  qualityGate: QualityGateStatus;
}

export interface NotificationScope {
  id: string;
  issues: DashboardIssue[];
  hotspots: DashboardHotspot[];
  qualityGate: QualityGateStatus;
}

const SNAPSHOT_KEY = 'sonarQubeDashboard.notificationSnapshots.v2';

export class NotificationManager {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async evaluate(
    scopes: readonly NotificationScope[],
    source: 'sync' | 'analysis' = 'sync'
  ): Promise<void> {
    const configuration = vscode.workspace.getConfiguration(DASHBOARD_CONFIGURATION_SECTION);
    if (!configuration.get<boolean>(DASHBOARD_CONFIGURATION_KEYS.notificationsEnabled, true)) {
      return;
    }

    const snapshots = {
      ...(this.context.workspaceState.get<Record<string, NotificationSnapshot>>(SNAPSHOT_KEY) ?? {})
    };
    const percent = configuration.get<number>(
      DASHBOARD_CONFIGURATION_KEYS.significantIncreasePercent,
      20
    );
    const minimum = configuration.get<number>(
      DASHBOARD_CONFIGURATION_KEYS.significantIncreaseMinimum,
      5
    );

    let newCriticalCount = 0;
    let newHotspotCount = 0;
    let significantIncrease = 0;
    let significantPrevious = 0;
    let significantTotal = 0;
    let qualityGateFailure: QualityGateStatus | undefined;

    for (const scope of scopes) {
      const next = this.snapshot(scope);
      const previous = snapshots[scope.id];
      snapshots[scope.id] = next;
      if (!previous) {
        continue;
      }

      newCriticalCount += next.criticalKeys
        .filter(key => !previous.criticalKeys.includes(key)).length;
      newHotspotCount += next.hotspotKeys
        .filter(key => !previous.hotspotKeys.includes(key)).length;

      const increase = next.total - previous.total;
      const significant = increase >= minimum && (
        previous.total === 0 ||
        increase / Math.max(1, previous.total) * 100 >= percent
      );
      if (significant && increase > significantIncrease) {
        significantIncrease = increase;
        significantPrevious = previous.total;
        significantTotal = next.total;
      }
      if (
        previous.qualityGate === 'OK' &&
        ['WARN', 'ERROR'].includes(next.qualityGate)
      ) {
        qualityGateFailure = next.qualityGate;
      }
    }

    await this.context.workspaceState.update(SNAPSHOT_KEY, snapshots);
    const spanish = getDashboardLanguage() === 'es';

    if (newCriticalCount > 0) {
      await this.notify(
        spanish
          ? `${newCriticalCount} nuevo(s) defecto(s) Blocker/Critical detectado(s).`
          : `${newCriticalCount} new Blocker/Critical issue(s) detected.`,
        true
      );
    }
    if (qualityGateFailure) {
      await this.notify(
        spanish
          ? `El Quality Gate ha pasado de OK a ${qualityGateFailure}.`
          : `The Quality Gate changed from OK to ${qualityGateFailure}.`,
        true
      );
    }
    if (significantIncrease > 0) {
      await this.notify(
        spanish
          ? `Los defectos han aumentado en ${significantIncrease} (${significantPrevious} → ${significantTotal}).`
          : `Issues increased by ${significantIncrease} (${significantPrevious} → ${significantTotal}).`,
        true
      );
    }
    if (newHotspotCount > 0) {
      await this.notify(
        spanish
          ? `${newHotspotCount} nuevo(s) Security Hotspot(s) detectado(s).`
          : `${newHotspotCount} new Security Hotspot(s) detected.`,
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

  private snapshot(scope: NotificationScope): NotificationSnapshot {
    return {
      issueKeys: scope.issues.map(issue => issue.key),
      criticalKeys: scope.issues
        .filter(issue =>
          ['BLOCKER', 'CRITICAL', 'HIGH'].includes(issue.severity.toUpperCase())
        )
        .map(issue => issue.key),
      hotspotKeys: scope.hotspots.map(hotspot => hotspot.key),
      total: scope.issues.length,
      qualityGate: scope.qualityGate
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
