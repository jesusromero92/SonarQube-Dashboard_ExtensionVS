export const EN_MESSAGES: Readonly<Record<string, string>> = {
  "remediation": "Remediation",
  'editorIntegration': 'Editor integration',
  'liveRemediation': 'Live remediation',
  'liveRemediationIntro': 'Keep the local state of synchronized issues up to date while you edit code without marking anything as fixed in SonarQube before the server confirms it.',
  'sonarIdeDetectedActive': 'SonarQube for IDE detected and active',
  'sonarIdeDetectedActiveHint': 'Its local diagnostics can independently confirm that a modified issue no longer reproduces before the next server analysis.',
  'sonarIdeInstalledInactive': 'SonarQube for IDE installed, not active yet',
  'sonarIdeInstalledInactiveHint': 'Open or save a supported file to activate its local analysis. Until then, changes remain pending validation.',
  'sonarIdeNotDetected': 'SonarQube for IDE not detected',
  'sonarIdeNotDetectedHint': 'It is optional. Modified issues remain pending validation until the next repository analysis.',
  "locallyModifiedIssues": "Issues modified locally",
  "noLocallyModifiedIssues": "There are no locally modified issues pending validation or confirmation.",
  "locallyModifiedAwaitingConfirmation": "Modified locally · awaiting SonarQube confirmation",
  'disableLiveRemediationModuleConfirm': 'Are you sure you want to disable the Live Remediation module? Local tracking will stop and its view will be hidden. Standard SonarQube diagnostics will continue to work.',
  'liveRemediationHint': 'Touched issues become locally modified and pending validation. If SonarQube for IDE stops reporting the same issue, it remains locally modified and moves to awaiting SonarQube confirmation; only server analysis can confirm that it is resolved.',
  'liveDiagnosticsInstalled': 'Installed',
  'liveDiagnosticsNotInstalled': 'Not installed'
};
