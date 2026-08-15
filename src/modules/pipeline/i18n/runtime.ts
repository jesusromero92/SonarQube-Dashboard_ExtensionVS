import {
  localizeAnalysisState as localizeCoreAnalysisState,
  localizeRuntimeText as localizeCoreRuntimeText
} from '../../../i18n';
import type { DashboardLanguage, LocalizedAnalysisState } from '../../../i18n/types';
import { PIPELINE_LOCALIZATION } from '.';

export function localizeRuntimeText(value: string, language: DashboardLanguage): string {
  return localizeCoreRuntimeText(value, language, [PIPELINE_LOCALIZATION]);
}

export function localizeAnalysisState<T extends LocalizedAnalysisState>(
  state: T,
  language: DashboardLanguage
): T {
  return localizeCoreAnalysisState(state, language, [PIPELINE_LOCALIZATION]);
}
