import * as vscode from 'vscode';
import { getFolderConfig } from './configuration';
import { DASHBOARD_COLORS } from './constants';
import { getDashboardLanguage } from './i18n';
import { fetchFileCoverageDetail } from './sonarClient';
import {
  CoverageFileSummary,
  CoverageLineStatus,
  CoverageSummary,
  FileCoverageDetail
} from './types';

type DecoratedCoverageStatus = Exclude<CoverageLineStatus, 'none'>;
const LINE_STATUSES: readonly DecoratedCoverageStatus[] = ['covered', 'partial', 'uncovered'];

function statusLabel(status: CoverageLineStatus): string {
  const spanish = getDashboardLanguage() === 'es';
  switch (status) {
    case 'covered': return spanish ? 'Línea cubierta' : 'Covered line';
    case 'partial': return spanish ? 'Cobertura parcial' : 'Partially covered line';
    case 'uncovered': return spanish ? 'Línea no cubierta' : 'Uncovered line';
    default: return spanish ? 'Sin datos de cobertura' : 'No coverage data';
  }
}

export class CoverageDecorationManager implements vscode.Disposable {
  private readonly filesByUri = new Map<string, CoverageFileSummary>();
  private readonly filesByComponent = new Map<string, CoverageFileSummary>();
  private readonly details = new Map<string, FileCoverageDetail>();
  private readonly loading = new Map<string, Promise<FileCoverageDetail>>();
  private readonly decorations = new Map<string, vscode.TextEditorDecorationType>();
  private generation = 0;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    extensionUri: vscode.Uri
  ) {
    for (const status of LINE_STATUSES) {
      const color = DASHBOARD_COLORS.coverage[status];
      this.decorations.set(status, vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: `${color}12`,
        overviewRulerColor: color,
        overviewRulerLane: vscode.OverviewRulerLane.Left,
        gutterIconPath: vscode.Uri.joinPath(extensionUri, 'assets', `coverage-${status}.svg`),
        gutterIconSize: '10px'
      }));
    }
    const duplicatedColor = DASHBOARD_COLORS.coverage.duplicated;
    this.decorations.set('duplicated', vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderStyle: 'dotted',
      borderWidth: '0 0 1px 0',
      borderColor: duplicatedColor,
      overviewRulerColor: duplicatedColor,
      overviewRulerLane: vscode.OverviewRulerLane.Center,
      after: {
        contentText: getDashboardLanguage() === 'es' ? '  duplicado' : '  duplicated',
        color: duplicatedColor,
        fontStyle: 'italic'
      }
    }));
    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors(editors => {
        for (const editor of editors) void this.decorate(editor);
      }),
      vscode.workspace.onDidCloseTextDocument(document => {
        this.details.delete(document.uri.toString());
      })
    );
  }

  setCoverage(summary: CoverageSummary): void {
    this.generation += 1;
    this.filesByUri.clear();
    this.filesByComponent.clear();
    this.details.clear();
    this.loading.clear();
    for (const file of summary.files) {
      this.filesByUri.set(file.fileUri, file);
      this.filesByComponent.set(file.component, file);
    }
    this.refreshVisibleEditors();
  }

  clear(): void {
    this.setCoverage({
      overall: {
        coverage: null,
        lineCoverage: null,
        branchCoverage: null,
        linesToCover: 0,
        uncoveredLines: 0,
        duplicatedLinesDensity: null,
        duplicatedBlocks: 0,
        duplicatedLines: 0
      },
      newCode: {
        coverage: null,
        lineCoverage: null,
        branchCoverage: null,
        linesToCover: 0,
        uncoveredLines: 0,
        duplicatedLinesDensity: null,
        duplicatedBlocks: 0,
        duplicatedLines: 0
      },
      files: []
    });
  }

  getFile(fileUri: string): CoverageFileSummary | undefined {
    return this.filesByUri.get(fileUri);
  }

  async getDetail(fileUri: string): Promise<FileCoverageDetail | undefined> {
    const file = this.filesByUri.get(fileUri);
    if (!file) return undefined;
    const cached = this.details.get(fileUri);
    if (cached) return cached;
    const existing = this.loading.get(fileUri);
    if (existing) return existing;
    const generation = this.generation;
    const promise = this.load(file).then(detail => {
      if (generation === this.generation) {
        this.details.set(fileUri, detail);
      }
      this.loading.delete(fileUri);
      return detail;
    }, error => {
      this.loading.delete(fileUri);
      throw error;
    });
    this.loading.set(fileUri, promise);
    return promise;
  }

  dispose(): void {
    this.clear();
    for (const disposable of this.disposables) disposable.dispose();
    for (const decoration of this.decorations.values()) decoration.dispose();
  }

  private async load(file: CoverageFileSummary): Promise<FileCoverageDetail> {
    const folder = vscode.workspace.workspaceFolders?.find(
      item => item.uri.toString() === file.folderUri
    );
    if (!folder) {
      throw new Error(
        getDashboardLanguage() === 'es'
          ? 'La carpeta asociada a la cobertura ya no está abierta.'
          : 'The folder associated with the coverage data is no longer open.'
      );
    }
    const config = await getFolderConfig(this.context, folder);
    if (!config) {
      throw new Error(
        getDashboardLanguage() === 'es'
          ? 'La carpeta no tiene una conexión válida con SonarQube.'
          : 'The folder does not have a valid SonarQube connection.'
      );
    }
    const detail = await fetchFileCoverageDetail(config, file);
    for (const group of detail.duplications) {
      for (const location of group.locations) {
        const local = this.filesByComponent.get(location.component);
        if (local) {
          location.fileUri = local.fileUri;
          location.relativePath = local.relativePath;
          location.isCurrentFile = local.fileUri === file.fileUri;
        }
      }
    }
    return detail;
  }

  private refreshVisibleEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) void this.decorate(editor);
  }

  private async decorate(editor: vscode.TextEditor): Promise<void> {
    for (const decoration of this.decorations.values()) {
      editor.setDecorations(decoration, []);
    }
    const file = this.filesByUri.get(editor.document.uri.toString());
    if (!file) return;
    try {
      const detail = await this.getDetail(file.fileUri);
      if (!detail || editor.document.uri.toString() !== file.fileUri) return;
      for (const status of LINE_STATUSES) {
        const options = detail.lines
          .filter(line => line.status === status)
          .map(line => {
            const lineIndex = Math.min(Math.max(0, line.line - 1), Math.max(0, editor.document.lineCount - 1));
            const conditionText = line.conditions > 0
              ? ` · ${line.coveredConditions}/${line.conditions}`
              : '';
            return {
              range: editor.document.lineAt(lineIndex).range,
              hoverMessage: `${statusLabel(status)}${line.hits === null ? '' : ` · hits: ${line.hits}`}${conditionText}`
            } satisfies vscode.DecorationOptions;
          });
        const decoration = this.decorations.get(status);
        if (decoration) editor.setDecorations(decoration, options);
      }
      const duplicated = detail.lines
        .filter(line => line.duplicated)
        .map(line => {
          const lineIndex = Math.min(Math.max(0, line.line - 1), Math.max(0, editor.document.lineCount - 1));
          return {
            range: editor.document.lineAt(lineIndex).range,
            hoverMessage: getDashboardLanguage() === 'es'
              ? 'Esta línea pertenece a un bloque duplicado.'
              : 'This line belongs to a duplicated block.'
          } satisfies vscode.DecorationOptions;
        });
      const duplicationDecoration = this.decorations.get('duplicated');
      if (duplicationDecoration) editor.setDecorations(duplicationDecoration, duplicated);
    } catch {
      // Coverage decorations are optional. API permissions and old server versions
      // must not interrupt the rest of the dashboard.
    }
  }
}
