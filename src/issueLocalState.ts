export type IssueLocalRemediationState =
  | 'server'
  | 'modified'
  | 'awaitingConfirmation';

export function localIssueStateLabel(
  state: Exclude<IssueLocalRemediationState, 'server'>,
  spanish: boolean
): string {
  if (state === 'awaitingConfirmation') {
    return spanish
      ? 'Modificado localmente · pendiente de confirmación de SonarQube'
      : 'Modified locally · awaiting SonarQube confirmation';
  }
  return spanish
    ? 'Modificado localmente · pendiente de validación'
    : 'Modified locally · pending validation';
}
