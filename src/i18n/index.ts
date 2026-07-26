import * as vscode from 'vscode';
import {
  DASHBOARD_CONFIGURATION_KEYS,
  DASHBOARD_CONFIGURATION_SECTION
} from '../constants';
import { EN_MESSAGES } from './en';
import { ES_MESSAGES } from './es';
import { SOURCE_MESSAGES } from './source';
import { DashboardLanguage, LocalizedAnalysisState } from './types';

export type { DashboardLanguage } from './types';

export const DEFAULT_DASHBOARD_LANGUAGE: DashboardLanguage = 'en';

const MESSAGE_CATALOGS = {
  en: EN_MESSAGES,
  es: ES_MESSAGES
} as const;

const SOURCE_ENTRIES = Object.entries(SOURCE_MESSAGES)
  .filter(([, value]) => Boolean(value))
  .sort((left, right) => right[1].length - left[1].length) as Array<
    [keyof typeof SOURCE_MESSAGES, string]
  >;

export function normalizeDashboardLanguage(value: unknown): DashboardLanguage {
  return value === 'es' ? 'es' : 'en';
}

export function getDashboardLanguage(): DashboardLanguage {
  const value = vscode.workspace
    .getConfiguration(DASHBOARD_CONFIGURATION_SECTION)
    .get<string>(
      DASHBOARD_CONFIGURATION_KEYS.language,
      DEFAULT_DASHBOARD_LANGUAGE
    );

  return normalizeDashboardLanguage(value);
}

export async function setDashboardLanguage(
  language: DashboardLanguage
): Promise<void> {
  await vscode.workspace
    .getConfiguration(DASHBOARD_CONFIGURATION_SECTION)
    .update(
      DASHBOARD_CONFIGURATION_KEYS.language,
      normalizeDashboardLanguage(language),
      vscode.ConfigurationTarget.Global
    );
}

export function localeTag(language: DashboardLanguage): string {
  return language === 'es' ? 'es-ES' : 'en-US';
}

export function message(
  language: DashboardLanguage,
  key: keyof typeof SOURCE_MESSAGES
): string {
  return MESSAGE_CATALOGS[language][key];
}

/**
 * Localizes the assembled HTML/JavaScript source before it is assigned to a
 * webview. The source currently uses the phrases in SOURCE_MESSAGES as stable
 * tokens; the visible text is selected from the English or Spanish catalog.
 */
export function localizeWebviewSource(
  source: string,
  language: DashboardLanguage
): string {
  let localized = source;
  const catalog = MESSAGE_CATALOGS[language];

  for (const [key, sourceText] of SOURCE_ENTRIES) {
    const targetText = catalog[key];
    if (sourceText === targetText) {
      continue;
    }

    if (/^[\p{L}\p{N}]+$/u.test(sourceText)) {
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}_])${escapeRegExp(sourceText)}(?![\\p{L}\\p{N}_])`,
        'gu'
      );
      localized = localized.replace(pattern, targetText);
    } else {
      localized = localized.split(sourceText).join(targetText);
    }
  }

  return localized;
}

/**
 * Localizes extension notifications, status-bar messages, scanner progress
 * messages and internally generated log lines while preserving dynamic data.
 */
export function localizeRuntimeText(
  value: string,
  language: DashboardLanguage
): string {
  return localizeWebviewSource(value, language);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function localizeAnalysisState<T extends LocalizedAnalysisState>(
  state: T,
  language: DashboardLanguage
): T {
  return {
    ...state,
    message: localizeRuntimeText(state.message, language),
    scanner: localizeRuntimeText(state.scanner, language),
    log: state.log.map(line => localizeRuntimeText(line, language))
  };
}
