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
    },
    ruleDetail: {
      title: 'Rule details',
      loading: 'Loading rule details…',
      loadError: 'Rule details could not be loaded.',
      key: 'Key',
      repository: 'Repository',
      language: 'Language',
      status: 'Status',
      type: 'Type',
      severity: 'Severity',
      branch: 'Branch',
      mainBranch: 'Main branch',
      file: 'File',
      line: 'Line',
      remediationEffort: 'Remediation effort',
      issueTypes: {
        BUG: 'Bug',
        CODE_SMELL: 'Code Smell',
        VULNERABILITY: 'Vulnerability'
      },
      scope: 'Scope',
      cleanCodeAttribute: 'Clean Code attribute',
      category: 'Category',
      template: 'Template',
      external: 'External rule',
      created: 'Created',
      updated: 'Updated',
      occurrences: 'Occurrences in this scope',
      exampleLocation: 'Example location',
      yes: 'Yes',
      no: 'No',
      notAvailable: 'Not available',
      noDescription: 'SonarQube did not provide a rule description.',
      softwareQuality: 'Software quality',
      functionType: 'Function',
      baseEffort: 'Base effort',
      gapMultiplier: 'Gap multiplier',
      gapDescription: 'Gap description',
      defaultValue: 'Default value',
      parameterType: 'Parameter type',
      inheritance: 'Inheritance',
      activeSeverity: 'Active severity'
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
    },
    ruleDetail: {
      title: 'Detalle de la regla',
      loading: 'Cargando detalle de la regla…',
      loadError: 'No se pudo cargar el detalle de la regla.',
      key: 'Clave',
      repository: 'Repositorio',
      language: 'Lenguaje',
      status: 'Estado',
      type: 'Tipo',
      severity: 'Severidad',
      branch: 'Rama',
      mainBranch: 'Rama principal',
      file: 'Archivo',
      line: 'Línea',
      remediationEffort: 'Esfuerzo de remediación',
      issueTypes: {
        BUG: 'Bug',
        CODE_SMELL: 'Code Smell',
        VULNERABILITY: 'Vulnerabilidad'
      },
      scope: 'Ámbito',
      cleanCodeAttribute: 'Atributo Clean Code',
      category: 'Categoría',
      template: 'Plantilla',
      external: 'Regla externa',
      created: 'Creada',
      updated: 'Actualizada',
      occurrences: 'Apariciones en este ámbito',
      exampleLocation: 'Ubicación de ejemplo',
      yes: 'Sí',
      no: 'No',
      notAvailable: 'No disponible',
      noDescription: 'SonarQube no ha proporcionado una descripción de la regla.',
      softwareQuality: 'Calidad de software',
      functionType: 'Función',
      baseEffort: 'Esfuerzo base',
      gapMultiplier: 'Multiplicador',
      gapDescription: 'Descripción del incremento',
      defaultValue: 'Valor predeterminado',
      parameterType: 'Tipo de parámetro',
      inheritance: 'Herencia',
      activeSeverity: 'Severidad activa'
    }
  }
} as const;

export type WebviewMessages = typeof WEBVIEW_MESSAGES.en | typeof WEBVIEW_MESSAGES.es;

export function getWebviewMessages(language: DashboardLanguage): WebviewMessages {
  return WEBVIEW_MESSAGES[language];
}
