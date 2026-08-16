export interface RatingPromptState {
  readonly firstSuccessAt?: number;
  readonly successCount?: number;
  readonly lastRatingPromptAt?: number;
  readonly lastErrorAt?: number;
  readonly ratingOpened?: boolean;
  readonly ratingDismissed?: boolean;
}

export interface SupportIssueMetadata {
  readonly extensionVersion: string;
  readonly vscodeVersion: string;
  readonly platform: string;
  readonly architecture: string;
  readonly remoteName?: string;
  readonly source?: string;
  readonly errorMessage?: string;
}

const RATING_MIN_SUCCESS_COUNT = 5;
const RATING_MIN_USAGE_MS = 3 * 24 * 60 * 60 * 1000;
const RATING_REPROMPT_MS = 60 * 24 * 60 * 60 * 1000;
const RATING_ERROR_GRACE_MS = 24 * 60 * 60 * 1000;
const SUPPORT_TEXT_LIMIT = 1600;

export function shouldPromptForRating(
  state: RatingPromptState,
  now: number
): boolean {
  if (state.ratingOpened || state.ratingDismissed) {
    return false;
  }
  if ((state.successCount ?? 0) < RATING_MIN_SUCCESS_COUNT) {
    return false;
  }
  const firstSuccessAt = state.firstSuccessAt ?? now;
  if (now - firstSuccessAt < RATING_MIN_USAGE_MS) {
    return false;
  }
  if (
    state.lastRatingPromptAt !== undefined &&
    now - state.lastRatingPromptAt < RATING_REPROMPT_MS
  ) {
    return false;
  }
  if (
    state.lastErrorAt !== undefined &&
    now - state.lastErrorAt < RATING_ERROR_GRACE_MS
  ) {
    return false;
  }
  return true;
}

export function sanitizeSupportText(value: string | undefined): string {
  if (!value) {
    return '';
  }

  let result = value;
  result = result.replace(
    /\b(Bearer)\s+[^\s,;]+/giu,
    '$1 [redacted]'
  );
  result = result.replace(
    /\b(token|password|secret|api[_-]?key|authorization|sonar\.login)\b(\s*[:=]\s*)[^\s,;&]+/giu,
    '$1$2[redacted]'
  );
  result = result.replace(
    /([?&](?:token|password|secret|api[_-]?key|authorization|sonar\.login)=)[^&#\s]+/giu,
    '$1[redacted]'
  );
  result = result.replace(/file:\/\/\/[^\s]+/giu, 'file:///[path]');
  result = result.replace(/[A-Za-z]:\\[^\r\n\t ]+/gu, '[path]');
  result = result.replace(/https?:\/\/[^\s]+/giu, '[url]');

  return result.slice(0, SUPPORT_TEXT_LIMIT);
}

export function buildMarketplaceRatingUrl(
  publisher: string,
  extensionName: string
): string {
  const itemName = `${publisher.trim()}.${extensionName.trim()}`;
  const url = new URL('https://marketplace.visualstudio.com/items');
  url.searchParams.set('itemName', itemName);
  url.hash = 'review-details';
  return url.toString();
}

const SUPPORT_BUG_REPORT_TEMPLATE = 'bug_report.yml';

export function buildSupportIssuePageUrl(issuesUrl: string): string {
  const url = new URL(issuesUrl.trim());
  const normalizedPath = url.pathname.replace(/\/+$/u, '');
  url.pathname = normalizedPath.endsWith('/issues')
    ? `${normalizedPath}/new`
    : normalizedPath;
  url.search = '';
  url.searchParams.set('template', SUPPORT_BUG_REPORT_TEMPLATE);
  url.hash = '';
  return url.toString();
}

export function buildSupportIssueReport(
  metadata: SupportIssueMetadata
): string {
  const source = sanitizeSupportText(metadata.source) || 'Extension';
  const errorMessage = sanitizeSupportText(metadata.errorMessage);
  const environment = [
    `- Extension: ${sanitizeSupportText(metadata.extensionVersion) || 'unknown'}`,
    `- VS Code: ${sanitizeSupportText(metadata.vscodeVersion) || 'unknown'}`,
    `- Platform: ${sanitizeSupportText(metadata.platform)} ${sanitizeSupportText(metadata.architecture)}`.trim(),
    `- Remote: ${sanitizeSupportText(metadata.remoteName) || 'none'}`,
    `- Source: ${source}`
  ];

  return [
    '## What happened?',
    '',
    errorMessage || '_Describe the problem here._',
    '',
    '## Environment',
    '',
    ...environment,
    '',
    '## Steps to reproduce',
    '',
    '1. ',
    '2. ',
    '3. ',
    '',
    '## Additional information',
    '',
    '_Add any extra context or attach the redacted diagnostics report if useful._',
    '',
    '> Tokens, secrets, workspace paths, SonarQube server URLs and project identifiers are not added automatically.'
  ].join('\n');
}
