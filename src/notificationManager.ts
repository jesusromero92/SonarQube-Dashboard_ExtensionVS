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

interface NotificationChanges {
  newCriticalCount: number;
  newHotspotCount: number;
  significantIncrease: number;
  significantPrevious: number;
  significantTotal: number;
  qualityGateFailure?: QualityGateStatus;
}

const SNAPSHOT_KEY = 'sonarQubeDashboard.notificationSnapshots.v2';

function confirmedAnalysisMessage(count: number, spanish: boolean): string {
  if (count <= 0) return '';
  if (spanish) {
    return count === 1
      ? ' SonarQube confirmó que 1 defecto modificado localmente ya no se detecta.'
      : ` SonarQube confirmó que ${count} defectos modificados localmente ya no se detectan.`;
  }
  return count === 1
    ? ' SonarQube confirmed that 1 locally modified issue is no longer detected.'
    : ` SonarQube confirmed that ${count} locally modified issues are no longer detected.`;
}

export class NotificationManager {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async evaluate(
    scopes: readonly NotificationScope[],
    source: 'sync' | 'analysis' = 'sync',
    confirmedLocallyModifiedCount = 0
  ): Promise<void> {
    const configuration = vscode.workspace.getConfiguration(DASHBOARD_CONFIGURATION_SECTION);
    if (!configuration.get<boolean>(DASHBOARD_CONFIGURATION_KEYS.notificationsEnabled, true)) {
      return;
    }

    const snapshots = {
      ...this.context.workspaceState.get<Record<string, NotificationSnapshot>>(SNAPSHOT_KEY)
    };
    const changes = this.collectChanges(
      scopes,
      snapshots,
      configuration.get<number>(DASHBOARD_CONFIGURATION_KEYS.significantIncreasePercent, 20),
      configuration.get<number>(DASHBOARD_CONFIGURATION_KEYS.significantIncreaseMinimum, 5)
    );

    await this.context.workspaceState.update(SNAPSHOT_KEY, snapshots);
    const spanish = getDashboardLanguage() === 'es';
    await this.notifyChanges(changes, spanish);

    if (source === 'analysis') {
      const confirmedMessage = confirmedAnalysisMessage(
        confirmedLocallyModifiedCount,
        spanish
      );
      await this.notify(
        spanish
          ? `El análisis ha terminado y el dashboard se ha actualizado.${confirmedMessage}`
          : `The analysis finished and the dashboard was refreshed.${confirmedMessage}`,
        false
      );
    }
  }

  private collectChanges(
    scopes: readonly NotificationScope[],
    snapshots: Record<string, NotificationSnapshot>,
    percent: number,
    minimum: number
  ): NotificationChanges {
    const changes: NotificationChanges = {
      newCriticalCount: 0,
      newHotspotCount: 0,
      significantIncrease: 0,
      significantPrevious: 0,
      significantTotal: 0
    };

    for (const scope of scopes) {
      const next = this.snapshot(scope);
      const previous = snapshots[scope.id];
      snapshots[scope.id] = next;
      if (!previous) continue;
      this.appendScopeChanges(changes, previous, next, percent, minimum);
    }
    return changes;
  }

  private appendScopeChanges(
    changes: NotificationChanges,
    previous: NotificationSnapshot,
    next: NotificationSnapshot,
    percent: number,
    minimum: number
  ): void {
    changes.newCriticalCount += next.criticalKeys
      .filter(key => !previous.criticalKeys.includes(key)).length;
    changes.newHotspotCount += next.hotspotKeys
      .filter(key => !previous.hotspotKeys.includes(key)).length;

    const increase = next.total - previous.total;
    const significant = increase >= minimum && (
      previous.total === 0 ||
      increase / Math.max(1, previous.total) * 100 >= percent
    );
    if (significant && increase > changes.significantIncrease) {
      changes.significantIncrease = increase;
      changes.significantPrevious = previous.total;
      changes.significantTotal = next.total;
    }
    if (previous.qualityGate === 'OK' && ['WARN', 'ERROR'].includes(next.qualityGate)) {
      changes.qualityGateFailure = next.qualityGate;
    }
  }

  private async notifyChanges(
    changes: NotificationChanges,
    spanish: boolean
  ): Promise<void> {
    if (changes.newCriticalCount > 0) {
      await this.notify(
        spanish
          ? `${changes.newCriticalCount} nuevo(s) defecto(s) Blocker/Critical detectado(s).`
          : `${changes.newCriticalCount} new Blocker/Critical issue(s) detected.`,
        true
      );
    }
    if (changes.qualityGateFailure) {
      await this.notify(
        spanish
          ? `El Quality Gate ha pasado de OK a ${changes.qualityGateFailure}.`
          : `The Quality Gate changed from OK to ${changes.qualityGateFailure}.`,
        true
      );
    }
    if (changes.significantIncrease > 0) {
      await this.notify(
        spanish
          ? `Los defectos han aumentado en ${changes.significantIncrease} (${changes.significantPrevious} → ${changes.significantTotal}).`
          : `Issues increased by ${changes.significantIncrease} (${changes.significantPrevious} → ${changes.significantTotal}).`,
        true
      );
    }
    if (changes.newHotspotCount > 0) {
      await this.notify(
        spanish
          ? `${changes.newHotspotCount} nuevo(s) Security Hotspot(s) detectado(s).`
          : `${changes.newHotspotCount} new Security Hotspot(s) detected.`,
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
