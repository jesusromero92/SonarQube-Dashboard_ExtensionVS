import * as vscode from 'vscode';

export type IssueDiagnosticSnapshot = ReadonlyMap<
  string,
  readonly vscode.Diagnostic[]
>;

export interface IssueDiagnosticPresentation {
  restoreServerSnapshot(): void;
  setPresentation(uri: vscode.Uri, diagnostics: readonly vscode.Diagnostic[]): void;
  deletePresentation(uri: vscode.Uri): void;
}

/**
 * Core owner of the Problems diagnostics published by the extension.
 *
 * Optional modules may temporarily change how the current server snapshot is
 * presented, but they never own the snapshot itself. Disabling or disposing an
 * optional module can therefore always restore the plain SonarQube diagnostics.
 */
export class IssueDiagnosticManager
implements vscode.Disposable, IssueDiagnosticPresentation {
  private readonly collection = vscode.languages.createDiagnosticCollection(
    'sonarqube-dashboard'
  );
  private readonly serverSnapshot = new Map<string, readonly vscode.Diagnostic[]>();

  replaceServerSnapshot(source: vscode.DiagnosticCollection): void {
    this.serverSnapshot.clear();
    source.forEach((uri, diagnostics) => {
      this.serverSnapshot.set(uri.toString(), [...diagnostics]);
    });
    this.restoreServerSnapshot();
  }

  getServerSnapshot(): IssueDiagnosticSnapshot {
    return this.serverSnapshot;
  }

  restoreServerSnapshot(): void {
    this.collection.clear();
    for (const [uriString, diagnostics] of this.serverSnapshot) {
      if (diagnostics.length > 0) {
        this.collection.set(vscode.Uri.parse(uriString), [...diagnostics]);
      }
    }
  }

  setPresentation(
    uri: vscode.Uri,
    diagnostics: readonly vscode.Diagnostic[]
  ): void {
    if (diagnostics.length > 0) {
      this.collection.set(uri, [...diagnostics]);
    } else {
      this.collection.delete(uri);
    }
  }

  deletePresentation(uri: vscode.Uri): void {
    this.collection.delete(uri);
  }

  clear(): void {
    this.serverSnapshot.clear();
    this.collection.clear();
  }

  dispose(): void {
    this.serverSnapshot.clear();
    this.collection.dispose();
  }
}
