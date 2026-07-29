import { createHash } from 'node:crypto';

export function normalizeConnectionServerUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, '');
}

export function connectionFingerprint(
  serverUrl: string,
  token: string
): string {
  return createHash('sha256')
    .update(normalizeConnectionServerUrl(serverUrl))
    .update('\0')
    .update(token)
    .digest('hex');
}

export function connectionNeedsValidation(
  savedServerUrl: string,
  storedToken: string | undefined,
  nextServerUrl: string,
  enteredToken: string
): boolean {
  return (
    normalizeConnectionServerUrl(savedServerUrl) !==
      normalizeConnectionServerUrl(nextServerUrl) ||
    Boolean(enteredToken && enteredToken !== storedToken)
  );
}
