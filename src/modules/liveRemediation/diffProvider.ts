import * as vscode from 'vscode';

const LIVE_REMEDIATION_DIFF_SCHEME = 'sonarqube-live-remediation';

export class LiveRemediationDiffProvider
implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly contents = new Map<string, string>();
  private readonly changedEmitter = new vscode.EventEmitter<vscode.Uri>();
  private sequence = 0;
  private static readonly MAX_DOCUMENTS = 40;

  readonly onDidChange = this.changedEmitter.event;

  createUri(
    issueKey: string,
    side: 'server' | 'local',
    relativePath: string,
    content: string
  ): vscode.Uri {
    this.sequence += 1;
    const safePath = relativePath.replaceAll('\\', '/').replace(/^\/+/, '');
    const uri = vscode.Uri.from({
      scheme: LIVE_REMEDIATION_DIFF_SCHEME,
      path: `/${side}/${this.sequence}/${safePath}`,
      query: `issue=${encodeURIComponent(issueKey)}`
    });
    this.contents.set(uri.toString(), content);
    while (this.contents.size > LiveRemediationDiffProvider.MAX_DOCUMENTS) {
      const oldest = this.contents.keys().next().value as string | undefined;
      if (!oldest) break;
      this.contents.delete(oldest);
    }
    return uri;
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) ?? '';
  }

  dispose(): void {
    this.contents.clear();
    this.changedEmitter.dispose();
  }
}

export { LIVE_REMEDIATION_DIFF_SCHEME };
