import { EN_MESSAGES } from './en';
import { ES_MESSAGES } from './es';
import { SOURCE_MESSAGES } from './source';
import { DashboardLanguage } from './types';
import type { LocalizationBundle } from './types';
import { getWebviewMessages, WebviewMessages } from './webview';

export interface WebviewLocalizationBundle {
  language: DashboardLanguage;
  locale: string;
  messages: WebviewMessages;
  translations: Array<[string, string]>;
  selectTranslations: Array<[string, string]>;
}

const CATALOGS = {
  en: EN_MESSAGES,
  es: ES_MESSAGES
} as const;

export function getWebviewLocalizationBundle(
  language: DashboardLanguage,
  moduleBundles: readonly LocalizationBundle[] = []
): WebviewLocalizationBundle {
  const targetCatalog = CATALOGS[language];
  const translations = new Map<string, string>();

  for (const key of Object.keys(SOURCE_MESSAGES) as Array<keyof typeof SOURCE_MESSAGES>) {
    const target = targetCatalog[key];
    addTranslationVariants(
      translations,
      target,
      SOURCE_MESSAGES[key],
      EN_MESSAGES[key],
      ES_MESSAGES[key]
    );
  }

  for (const bundle of moduleBundles) {
    const target = language === 'es' ? bundle.es : bundle.en;
    for (const key of Object.keys(bundle.source)) {
      addTranslationVariants(
        translations,
        target[key] ?? bundle.source[key],
        bundle.source[key],
        bundle.en[key],
        bundle.es[key]
      );
    }
  }

  const targetMessages = getWebviewMessages(language);
  addNestedMessageTranslations(
    translations,
    targetMessages,
    getWebviewMessages('en'),
    getWebviewMessages('es')
  );

  const selectTranslations = new Map<string, string>();
  for (const key of ['project', 'application'] as const) {
    addTranslationVariants(
      selectTranslations,
      targetCatalog[key],
      SOURCE_MESSAGES[key],
      EN_MESSAGES[key],
      ES_MESSAGES[key]
    );
  }

  return {
    language,
    locale: language === 'es' ? 'es-ES' : 'en-US',
    messages: targetMessages,
    translations: [...translations.entries()].sort(
      ([left], [right]) => right.length - left.length
    ),
    selectTranslations: [...selectTranslations.entries()].sort(
      ([left], [right]) => right.length - left.length
    )
  };
}

function addTranslationVariants(
  translations: Map<string, string>,
  target: string,
  ...variants: string[]
): void {
  for (const variant of new Set(variants)) {
    if (variant && !translations.has(variant)) {
      translations.set(variant, target);
    }
  }
}

function addNestedMessageTranslations(
  translations: Map<string, string>,
  target: unknown,
  english: unknown,
  spanish: unknown
): void {
  if (typeof target === 'string') {
    addTranslationVariants(
      translations,
      target,
      typeof english === 'string' ? english : '',
      typeof spanish === 'string' ? spanish : ''
    );
    return;
  }

  if (!target || typeof target !== 'object') {
    return;
  }

  for (const key of Object.keys(target as Record<string, unknown>)) {
    addNestedMessageTranslations(
      translations,
      (target as Record<string, unknown>)[key],
      (english as Record<string, unknown> | undefined)?.[key],
      (spanish as Record<string, unknown> | undefined)?.[key]
    );
  }
}

/**
 * Creates a small runtime localizer shared by the main dashboard and the
 * Activity Bar summary. It changes text nodes and localizable attributes in
 * place, so switching language does not recreate the webview or lose its UI
 * state.
 */
export function getRuntimeLocalizationScript(
  initialBundle: WebviewLocalizationBundle
): string {
  return String.raw`
    let dashboardLanguage = ${JSON.stringify(initialBundle.language)};
    let dashboardLocale = ${JSON.stringify(initialBundle.locale)};
    let dashboardMessages = ${JSON.stringify(initialBundle.messages)};
    let localizationExactTranslations = new Map();
    let localizationFragmentTranslations = [];
    let localizationSelectTranslations = [];
    let localizationObserver;

    const localizationAttributes = [
      'aria-label',
      'aria-description',
      'placeholder',
      'title'
    ];

    function localizationElementFor(node) {
      return node.nodeType === Node.ELEMENT_NODE
        ? node
        : node.parentElement;
    }

    function shouldSkipLocalizationText(node) {
      return Boolean(
        localizationElementFor(node)?.closest(
          'script, style, code, pre, textarea, input, [data-i18n-ignore="true"]'
        )
      );
    }

    function shouldSkipLocalizationElement(node) {
      return Boolean(
        localizationElementFor(node)?.closest(
          'script, style, code, pre, [data-i18n-ignore="true"]'
        )
      );
    }

    function isLocalizationFragment(value) {
      return (
        value.length > 1 &&
        (/^\s|\s$/.test(value) || /[:：]\s*$/.test(value) || value.includes('…'))
      );
    }

    function configureLocalizationEntries(entries, selectEntries) {
      localizationExactTranslations = new Map(entries || []);
      localizationFragmentTranslations = (entries || []).filter(
        ([source, target]) =>
          source !== target && isLocalizationFragment(source)
      );
      localizationSelectTranslations = (selectEntries || []).filter(
        ([source, target]) => source !== target
      );
    }

    function escapeLocalizationRegExp(value) {
      const specialCharacters = '.*+?^$()|[]{}';
      const backslash = String.fromCharCode(92);
      return Array.from(value, character =>
        specialCharacters.includes(character) || character === backslash
          ? backslash + character
          : character
      ).join('');
    }

    function translateSelectFragments(value) {
      let translated = value;
      for (const [source, target] of localizationSelectTranslations) {
        const pattern = new RegExp(
          '(?<![\p{L}\p{N}_])' +
            escapeLocalizationRegExp(source) +
            '(?![\p{L}\p{N}_])',
          'gu'
        );
        translated = translated.replace(pattern, target);
      }
      return translated;
    }

    function translateLocalizationValue(value, translateSelectWords = false) {
      if (!value) {
        return value;
      }

      const direct = localizationExactTranslations.get(value);
      if (direct !== undefined) {
        return direct;
      }

      const leading = value.match(/^\s*/)?.[0] || '';
      const trailing = value.match(/\s*$/)?.[0] || '';
      const coreEnd = value.length - trailing.length;
      const core = value.slice(leading.length, coreEnd);
      const translatedCore = localizationExactTranslations.get(core);
      if (translatedCore !== undefined) {
        return leading + translatedCore + trailing;
      }

      let translated = value;
      for (const [source, target] of localizationFragmentTranslations) {
        if (translated.includes(source)) {
          translated = translated.split(source).join(target);
        }
      }

      return translateSelectWords
        ? translateSelectFragments(translated)
        : translated;
    }

    function isSelectLocalizationNode(node) {
      return Boolean(
        localizationElementFor(node)?.closest('[data-select-dropdown], option')
      );
    }

    function translateLocalizationTextNode(node) {
      if (shouldSkipLocalizationText(node)) {
        return;
      }

      const translated = translateLocalizationValue(
        node.nodeValue || '',
        isSelectLocalizationNode(node)
      );
      if (translated !== node.nodeValue) {
        node.nodeValue = translated;
      }
    }

    function translateLocalizationElement(element) {
      if (shouldSkipLocalizationElement(element)) {
        return;
      }

      for (const attribute of localizationAttributes) {
        if (!element.hasAttribute(attribute)) {
          continue;
        }
        const current = element.getAttribute(attribute) || '';
        const translated = translateLocalizationValue(
          current,
          isSelectLocalizationNode(element)
        );
        if (translated !== current) {
          element.setAttribute(attribute, translated);
        }
      }
    }

    function translateLocalizationTree(root = document.body) {
      if (!root) {
        return;
      }

      if (root.nodeType === Node.TEXT_NODE) {
        translateLocalizationTextNode(root);
        return;
      }

      if (root.nodeType === Node.ELEMENT_NODE) {
        translateLocalizationElement(root);
      }

      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
      );
      let node = walker.nextNode();
      while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          translateLocalizationTextNode(node);
        } else {
          translateLocalizationElement(node);
        }
        node = walker.nextNode();
      }
    }

    function observeLocalizationChanges() {
      localizationObserver?.disconnect();
      localizationObserver = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          if (mutation.type === 'characterData') {
            translateLocalizationTextNode(mutation.target);
            continue;
          }

          if (mutation.type === 'attributes') {
            translateLocalizationElement(mutation.target);
            continue;
          }

          for (const node of mutation.addedNodes) {
            translateLocalizationTree(node);
          }
        }
      });
      localizationObserver.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: localizationAttributes
      });
    }

    function applyDashboardLocalization(bundle) {
      if (!bundle) {
        return;
      }

      dashboardLanguage = bundle.language || dashboardLanguage;
      dashboardLocale = bundle.locale || dashboardLocale;
      dashboardMessages = bundle.messages || dashboardMessages;
      document.documentElement.lang = dashboardLanguage;
      configureLocalizationEntries(
        bundle.translations || [],
        bundle.selectTranslations || []
      );

      localizationObserver?.disconnect();
      translateLocalizationTree(document.documentElement);
      observeLocalizationChanges();
    }

    applyDashboardLocalization(${JSON.stringify(initialBundle)});
`;
}
