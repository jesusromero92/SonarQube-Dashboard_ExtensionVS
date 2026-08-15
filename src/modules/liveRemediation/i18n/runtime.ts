import { localizeRuntimeText as localizeCoreRuntimeText } from '../../../i18n';
import type { DashboardLanguage } from '../../../i18n/types';
import { LIVE_REMEDIATION_LOCALIZATION } from '.';

export function localizeRuntimeText(value: string, language: DashboardLanguage): string {
  return localizeCoreRuntimeText(value, language, [LIVE_REMEDIATION_LOCALIZATION]);
}
