import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { DashboardLanguage } from '../../i18n';
import { getDashboardWebviewAssets } from './assets';
import { getDashboardBody } from './body';
import { getDashboardScript } from './scripts';
import { getDashboardStyles } from './styles';

export function getDashboardHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  language: DashboardLanguage
): string {
  const nonce = randomBytes(16).toString('hex');
  const assets = getDashboardWebviewAssets(webview, extensionUri);

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${webview.cspSource}; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"
  >
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style nonce="${nonce}">
${getDashboardStyles(assets)}
  </style>
</head>
<body>
${getDashboardBody()}
  <script nonce="${nonce}">
${getDashboardScript(language)}
  </script>
</body>
</html>`;
}
