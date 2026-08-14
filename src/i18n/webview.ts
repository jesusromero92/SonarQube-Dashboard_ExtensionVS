import { DashboardLanguage } from './types';

type LocalizedPair = readonly [english: string, spanish: string];
type LocalizedTree = {
  readonly [key: string]: LocalizedPair | LocalizedTree;
};
type ResolvedLocalizedTree<T> = T extends LocalizedPair
  ? string
  : T extends LocalizedTree
    ? { readonly [K in keyof T]: ResolvedLocalizedTree<T[K]> }
    : never;

const WEBVIEW_MESSAGE_SOURCE = {
  issueSingular: [' issue', ' defecto'],
  issuePlural: [' issues', ' defectos'],
  of: [' of ', ' de '],
  hotspotSingular: [' hotspot', ' Security Hotspot'],
  hotspotPlural: [' hotspots', ' Security Hotspots'],
  hotspotStatus: {
    TO_REVIEW: ['To review', 'Pendiente de revisión'],
    REVIEWED: ['Reviewed', 'Revisado'],
    ACKNOWLEDGED: ['Acknowledged', 'Reconocido'],
    FIXED: ['Fixed', 'Corregido'],
    SAFE: ['Safe', 'Seguro']
  },
  hotspotPriority: {
    HIGH: ['High', 'Alta'],
    MEDIUM: ['Medium', 'Media'],
    LOW: ['Low', 'Baja'],
    UNKNOWN: ['Unknown', 'Desconocida']
  },
  ruleDetail: {
    title: ['Rule details', 'Detalle de la regla'],
    loading: ['Loading rule details…', 'Cargando detalle de la regla…'],
    loadError: [
      'Rule details could not be loaded.',
      'No se pudo cargar el detalle de la regla.'
    ],
    key: ['Key', 'Clave'],
    repository: ['Repository', 'Repositorio'],
    language: ['Language', 'Lenguaje'],
    status: ['Status', 'Estado'],
    type: ['Type', 'Tipo'],
    severity: ['Severity', 'Severidad'],
    branch: ['Branch', 'Rama'],
    mainBranch: ['Main branch', 'Rama principal'],
    file: ['File', 'Archivo'],
    line: ['Line', 'Línea'],
    remediationEffort: ['Remediation effort', 'Esfuerzo de remediación'],
    issueTypes: {
      BUG: ['Bug', 'Bug'],
      CODE_SMELL: ['Code Smell', 'Code Smell'],
      VULNERABILITY: ['Vulnerability', 'Vulnerabilidad']
    },
    scope: ['Scope', 'Ámbito'],
    cleanCodeAttribute: ['Clean Code attribute', 'Atributo Clean Code'],
    category: ['Category', 'Categoría'],
    template: ['Template', 'Plantilla'],
    external: ['External rule', 'Regla externa'],
    created: ['Created', 'Creada'],
    updated: ['Updated', 'Actualizada'],
    occurrences: ['Occurrences in this scope', 'Apariciones en este ámbito'],
    exampleLocation: ['Example location', 'Ubicación de ejemplo'],
    yes: ['Yes', 'Sí'],
    no: ['No', 'No'],
    notAvailable: ['Not available', 'No disponible'],
    noDescription: [
      'SonarQube did not provide a rule description.',
      'SonarQube no ha proporcionado una descripción de la regla.'
    ],
    softwareQuality: ['Software quality', 'Calidad de software'],
    functionType: ['Function', 'Función'],
    baseEffort: ['Base effort', 'Esfuerzo base'],
    gapMultiplier: ['Gap multiplier', 'Multiplicador'],
    gapDescription: ['Gap description', 'Descripción del incremento'],
    defaultValue: ['Default value', 'Valor predeterminado'],
    parameterType: ['Parameter type', 'Tipo de parámetro'],
    inheritance: ['Inheritance', 'Herencia'],
    activeSeverity: ['Active severity', 'Severidad activa']
  }
} as const satisfies LocalizedTree;

export type WebviewMessages = ResolvedLocalizedTree<typeof WEBVIEW_MESSAGE_SOURCE>;

const LANGUAGE_INDEX: Record<DashboardLanguage, 0 | 1> = {
  en: 0,
  es: 1
};

const WEBVIEW_MESSAGES: Record<DashboardLanguage, WebviewMessages> = {
  en: resolveLocalizedTree(WEBVIEW_MESSAGE_SOURCE, LANGUAGE_INDEX.en),
  es: resolveLocalizedTree(WEBVIEW_MESSAGE_SOURCE, LANGUAGE_INDEX.es)
};

export function getWebviewMessages(language: DashboardLanguage): WebviewMessages {
  return WEBVIEW_MESSAGES[language];
}

function resolveLocalizedTree<T extends LocalizedTree>(
  source: T,
  languageIndex: 0 | 1
): ResolvedLocalizedTree<T> {
  const entries = Object.entries(source).map(([key, value]) => [
    key,
    resolveLocalizedValue(value, languageIndex)
  ]);

  return Object.fromEntries(entries) as ResolvedLocalizedTree<T>;
}

function resolveLocalizedValue<T extends LocalizedPair | LocalizedTree>(
  value: T,
  languageIndex: 0 | 1
): ResolvedLocalizedTree<T> {
  if (Array.isArray(value)) {
    return value[languageIndex] as ResolvedLocalizedTree<T>;
  }

  return resolveLocalizedTree(
    value as LocalizedTree,
    languageIndex
  ) as ResolvedLocalizedTree<T>;
}
