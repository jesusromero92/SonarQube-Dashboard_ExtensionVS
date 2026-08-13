import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { CoverageDecorationManager } from '../coverageDecorations';
import { getDashboardLanguage } from '../i18n';
import { DuplicationLocation, FileCoverageDetail } from '../types';

interface DuplicationSnippet {
  location: DuplicationLocation;
  lines: Array<{ number: number; text: string }>;
}

export class DuplicationComparisonPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private locations: DuplicationLocation[] = [];
  private readonly panelDisposables: vscode.Disposable[] = [];

  constructor(private readonly coverage: CoverageDecorationManager) {}

  async show(fileUri: string, selectedGroupIndex = 0): Promise<void> {
    const detail = await this.coverage.getDetail(fileUri);
    if (!detail) {
      throw new Error(
        getDashboardLanguage() === 'es'
          ? 'No se encontraron datos de duplicación para el archivo.'
          : 'No duplication data was found for the file.'
      );
    }
    const snippets = await Promise.all(
      detail.duplications.map(group =>
        Promise.all(group.locations.map(location => this.readSnippet(location)))
      )
    );
    this.locations = snippets.flat().map(snippet => snippet.location);

    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'sonarQubeDashboard.duplicationComparison',
        getDashboardLanguage() === 'es'
          ? 'Comparación de código duplicado'
          : 'Duplicated code comparison',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
      );
      this.panelDisposables.push(
        this.panel.onDidDispose(() => {
          this.panel = undefined;
          this.locations = [];
          this.disposePanelListeners();
        }),
        this.panel.webview.onDidReceiveMessage(async message => {
          if (message?.type !== 'openLocation') {
            return;
          }
          const location = this.locations[Number(message.index)];
          if (location) {
            await this.openLocation(location);
          }
        })
      );
    } else {
      this.panel.reveal(vscode.ViewColumn.One, false);
    }

    this.panel.webview.html = this.getHtml(detail, snippets, selectedGroupIndex);
  }

  dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
    this.disposePanelListeners();
  }

  private async readSnippet(location: DuplicationLocation): Promise<DuplicationSnippet> {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(location.fileUri));
    const firstLine = Math.min(
      Math.max(0, location.from - 1),
      Math.max(0, document.lineCount - 1)
    );
    const lastLine = Math.min(
      firstLine + Math.max(1, location.size) - 1,
      Math.max(0, document.lineCount - 1)
    );
    const lines: DuplicationSnippet['lines'] = [];
    for (let line = firstLine; line <= lastLine; line += 1) {
      lines.push({
        number: line + 1,
        text: document.lineAt(line).text
      });
    }
    return { location, lines };
  }

  private async openLocation(location: DuplicationLocation): Promise<void> {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(location.fileUri));
    const startLine = Math.min(
      Math.max(0, location.from - 1),
      Math.max(0, document.lineCount - 1)
    );
    const endLine = Math.min(
      startLine + Math.max(1, location.size) - 1,
      Math.max(0, document.lineCount - 1)
    );
    const editor = await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: false
    });
    const range = new vscode.Range(
      startLine,
      0,
      endLine,
      document.lineAt(endLine).text.length
    );
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  }

  private getHtml(
    detail: FileCoverageDetail,
    groups: DuplicationSnippet[][],
    selectedGroupIndex: number
  ): string {
    const spanish = getDashboardLanguage() === 'es';
    const nonce = randomBytes(16).toString('hex');
    let locationIndex = 0;
    const groupMarkup = groups.map((group, groupIndex) => {
      const panes = group.map(snippet => {
        const index = locationIndex;
        locationIndex += 1;
        const end = snippet.location.from + Math.max(1, snippet.location.size) - 1;
        const lines = snippet.lines.map(line =>
          `<div class="code-line"><span class="line-number">${line.number}</span>` +
          `<code>${escapeHtml(line.text) || ' '}</code></div>`
        ).join('');
        return `<article class="code-pane">
          <header>
            <div>
              <strong title="${escapeAttribute(snippet.location.relativePath)}">${escapeHtml(snippet.location.relativePath)}</strong>
              <span>${spanish ? 'Líneas' : 'Lines'} ${snippet.location.from}–${end}</span>
            </div>
            <button type="button" data-location="${index}">${spanish ? 'Abrir archivo' : 'Open file'}</button>
          </header>
          <div class="code-block">${lines}</div>
        </article>`;
      }).join('');
      return `<section id="group-${groupIndex}" class="comparison-group">
        <h2>${spanish ? 'Grupo' : 'Group'} ${groupIndex + 1}</h2>
        <div class="comparison-grid">${panes}</div>
      </section>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="${spanish ? 'es' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${spanish ? 'Comparación de código duplicado' : 'Duplicated code comparison'}</title>
  <style nonce="${nonce}">
    * { box-sizing: border-box; }
    html { scrollbar-gutter: stable; }
    body { margin: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); }
    .page-header { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 14px; padding: 14px 18px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-editorGroupHeader-tabsBackground); }
    .page-header h1 { margin: 0; font-size: 17px; }
    .page-header span { color: var(--vscode-descriptionForeground); }
    main { display: grid; gap: 18px; padding: 18px; }
    .comparison-group { min-width: 0; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
    .comparison-group h2 { margin: 0; padding: 10px 12px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 13px; }
    .comparison-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(430px, 100%), 1fr)); }
    .code-pane { min-width: 0; border-right: 1px solid var(--vscode-panel-border); }
    .code-pane:last-child { border-right: 0; }
    .code-pane header { display: flex; min-height: 54px; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBarSectionHeader-background); }
    .code-pane header div { min-width: 0; }
    .code-pane strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .code-pane header span { display: block; margin-top: 2px; color: var(--vscode-descriptionForeground); font-size: 11px; }
    button { flex: 0 0 auto; padding: 5px 9px; border: 1px solid var(--vscode-button-border, transparent); color: var(--vscode-button-foreground); background: var(--vscode-button-background); font: inherit; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .code-block { overflow-x: auto; padding: 6px 0; background: var(--vscode-textCodeBlock-background, var(--vscode-editor-background)); font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); line-height: 1.45; }
    .code-line { display: grid; min-width: max-content; grid-template-columns: 58px minmax(0, 1fr); background: color-mix(in srgb, var(--vscode-diffEditor-insertedLineBackground) 65%, transparent); }
    .code-line:hover { background: var(--vscode-list-hoverBackground); }
    .line-number { padding: 0 10px 0 6px; color: var(--vscode-editorLineNumber-foreground); border-right: 1px solid var(--vscode-panel-border); text-align: right; user-select: none; }
    code { display: block; padding: 0 12px; white-space: pre; }
    @media (max-width: 900px) { .comparison-grid { grid-template-columns: 1fr; } .code-pane { border-right: 0; border-bottom: 1px solid var(--vscode-panel-border); } }
  </style>
</head>
<body>
  <header class="page-header">
    <h1>${spanish ? 'Código duplicado' : 'Duplicated code'}</h1>
    <span>${escapeHtml(detail.file.relativePath)} · ${groups.length} ${localizedGroupLabel(groups.length, spanish)}</span>
  </header>
  <main>${groupMarkup}</main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('[data-location]').forEach(button => {
      button.addEventListener('click', () => vscode.postMessage({
        type: 'openLocation',
        index: Number(button.dataset.location)
      }));
    });
    document.getElementById('group-${Math.max(0, selectedGroupIndex)}')?.scrollIntoView({ block: 'start' });
  </script>
</body>
</html>`;
  }

  private disposePanelListeners(): void {
    while (this.panelDisposables.length > 0) {
      this.panelDisposables.pop()?.dispose();
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, ' ');
}

function localizedGroupLabel(count: number, spanish: boolean): string {
  if (spanish) {
    return count === 1 ? 'grupo' : 'grupos';
  }
  return count === 1 ? 'group' : 'groups';
}
