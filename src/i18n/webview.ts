import { DashboardLanguage } from './types';

const WEBVIEW_MESSAGES = {
  en: {
    issueSingular: ' issue',
    issuePlural: ' issues',
    of: ' of ',
    hotspotSingular: ' hotspot',
    hotspotPlural: ' hotspots',
    hotspotStatus: {
      TO_REVIEW: 'To review',
      REVIEWED: 'Reviewed',
      ACKNOWLEDGED: 'Acknowledged',
      FIXED: 'Fixed',
      SAFE: 'Safe'
    },
    hotspotPriority: {
      HIGH: 'High',
      MEDIUM: 'Medium',
      LOW: 'Low',
      UNKNOWN: 'Unknown'
    }
  },
  es: {
    issueSingular: ' defecto',
    issuePlural: ' defectos',
    of: ' de ',
    hotspotSingular: ' Security Hotspot',
    hotspotPlural: ' Security Hotspots',
    hotspotStatus: {
      TO_REVIEW: 'Pendiente de revisión',
      REVIEWED: 'Revisado',
      ACKNOWLEDGED: 'Reconocido',
      FIXED: 'Corregido',
      SAFE: 'Seguro'
    },
    hotspotPriority: {
      HIGH: 'Alta',
      MEDIUM: 'Media',
      LOW: 'Baja',
      UNKNOWN: 'Desconocida'
    }
  }
} as const;

export type WebviewMessages = typeof WEBVIEW_MESSAGES.en | typeof WEBVIEW_MESSAGES.es;

export function getWebviewMessages(language: DashboardLanguage): WebviewMessages {
  return WEBVIEW_MESSAGES[language];
}
