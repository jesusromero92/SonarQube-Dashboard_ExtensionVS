import { createHash } from 'node:crypto';
import { stringifyUnknown, trimTrailingSlashes } from '../textUtils';

export function normalizeConnectionServerUrl(serverUrl: string): string {
  return trimTrailingSlashes(serverUrl.trim());
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

function errorStatus(error: unknown): number | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status;
  }
  return undefined;
}

export function connectionErrorMessage(error: unknown): string {
  const status = errorStatus(error);
  if (status === 401 || status === 403) {
    return 'El token de SonarQube no es válido.';
  }
  if (status === 404) {
    return 'La URL no corresponde a un servidor SonarQube compatible.';
  }

  const value = error instanceof Error ? error.message : stringifyUnknown(error);
  const cause = error instanceof Error ? stringifyUnknown(error.cause ?? '') : '';
  if (
    error instanceof TypeError ||
    /fetch failed|network|enotfound|econnrefused|econnreset|etimedout|certificate|ssl|tls/i.test(
      `${value} ${cause}`
    )
  ) {
    return 'SonarQube no está disponible. Comprueba que el servidor esté iniciado y que la URL sea accesible.';
  }
  if (error instanceof SyntaxError) {
    return 'La URL no corresponde a un servidor SonarQube compatible.';
  }

  return value;
}
