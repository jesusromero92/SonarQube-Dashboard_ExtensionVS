import * as vscode from 'vscode';
import { DASHBOARD_TYPE_ICON_FILES } from '../../constants';

export interface DashboardWebviewAssets {
  bugIconUri: vscode.Uri;
  codeSmellIconUri: vscode.Uri;
  vulnerabilityIconUri: vscode.Uri;
}

export function getDashboardWebviewAssets(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): DashboardWebviewAssets {
  const assetUri = (fileName: string): vscode.Uri =>
    webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', fileName));

  return {
    bugIconUri: assetUri(DASHBOARD_TYPE_ICON_FILES.BUG),
    codeSmellIconUri: assetUri(DASHBOARD_TYPE_ICON_FILES.CODE_SMELL),
    vulnerabilityIconUri: assetUri(DASHBOARD_TYPE_ICON_FILES.VULNERABILITY)
  };
}
