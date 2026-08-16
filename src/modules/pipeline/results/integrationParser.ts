import { getRegisteredIntegrationProvider } from '../integrations/registry';
import type { PipelineStructuredResult, PipelineToolOutput } from './contracts';

/**
 * Resolves and runs the parser registered by the integration provider.
 * Kept outside AnalysisService so execution and persistence tests exercise
 * the same provider-to-parser path as the extension runtime.
 */
export function parseRegisteredIntegrationResult(
  output: PipelineToolOutput
): PipelineStructuredResult | undefined {
  return getRegisteredIntegrationProvider(output.toolId)?.parseResult?.(output);
}
