import type { CanonicalParameters } from './contracts';

export interface ParameterTranslationContext {
  readonly target: URLSearchParams;
  readonly key: string;
  readonly value: string;
}

export type ParameterTranslationHandler = (
  context: ParameterTranslationContext
) => void;

export type ParameterTranslationHandlers = Readonly<
  Record<string, ParameterTranslationHandler>
>;

export interface ParameterTranslationOptions {
  readonly handlers?: ParameterTranslationHandlers;
  readonly copyUnmapped?: boolean;
}

/**
 * Translates a canonical parameter collection through a small handler map.
 * Empty keys and values are ignored consistently for every Sonar endpoint.
 */
export function translateCanonicalParameters(
  canonical: CanonicalParameters,
  options: ParameterTranslationOptions = {}
): URLSearchParams {
  const target = new URLSearchParams();
  const handlers = options.handlers ?? {};
  const copyUnmapped = options.copyUnmapped ?? true;

  for (const [key, rawValue] of Object.entries(canonical)) {
    const value = rawValue?.trim() ?? '';
    if (!key || !value) {
      continue;
    }

    const handler = handlers[key];
    if (handler) {
      handler({ target, key, value });
    } else if (copyUnmapped) {
      target.set(key, value);
    }
  }

  return target;
}

/** Creates handlers that only rename parameters and preserve their values. */
export function createAliasHandlers(
  aliases: Readonly<Record<string, string>>
): ParameterTranslationHandlers {
  return Object.fromEntries(
    Object.entries(aliases).map(([canonicalKey, targetKey]) => [
      canonicalKey,
      ({ target, value }: ParameterTranslationContext) => {
        if (targetKey) {
          target.set(targetKey, value);
        }
      }
    ])
  );
}

/** Explicit no-op used for canonical parameters handled after the main pass. */
export const ignoreParameter: ParameterTranslationHandler = () => undefined;
