import type { LocalizationBundle } from '../../../i18n/types';
import { EN_MESSAGES } from './en';
import { ES_MESSAGES } from './es';
import { SOURCE_MESSAGES } from './source';

export const PIPELINE_LOCALIZATION: LocalizationBundle = {
  source: SOURCE_MESSAGES,
  en: EN_MESSAGES,
  es: ES_MESSAGES
};
