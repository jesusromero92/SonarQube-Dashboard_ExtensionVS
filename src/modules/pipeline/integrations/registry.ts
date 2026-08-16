import type {
  DetectedProjectIntegration,
  IntegrationDetectionContext,
  PipelineIntegrationProvider,
  ProjectIntegrationCatalogItem
} from './contracts';
import { biomeIntegrationProvider } from './providers/biome';
import { banditIntegrationProvider } from './providers/bandit';
import { checkovIntegrationProvider } from './providers/checkov';
import { dependencyAuditIntegrationProvider } from './providers/dependencyAudit';
import { eslintIntegrationProvider } from './providers/eslint';
import { golangciLintIntegrationProvider } from './providers/golangciLint';
import { owaspDependencyCheckIntegrationProvider } from './providers/owaspDependencyCheck';
import { prettierIntegrationProvider } from './providers/prettier';
import { reactDoctorIntegrationProvider } from './providers/reactDoctor';
import { ruffIntegrationProvider } from './providers/ruff';
import { semgrepIntegrationProvider } from './providers/semgrep';
import { snykIntegrationProvider } from './providers/snyk';
import { stylelintIntegrationProvider } from './providers/stylelint';
import { trivyIntegrationProvider } from './providers/trivy';

export const PIPELINE_INTEGRATION_PROVIDERS: readonly PipelineIntegrationProvider[] = Object.freeze([
  dependencyAuditIntegrationProvider,
  eslintIntegrationProvider,
  reactDoctorIntegrationProvider,
  biomeIntegrationProvider,
  stylelintIntegrationProvider,
  prettierIntegrationProvider,
  semgrepIntegrationProvider,
  snykIntegrationProvider,
  trivyIntegrationProvider,
  owaspDependencyCheckIntegrationProvider,
  ruffIntegrationProvider,
  banditIntegrationProvider,
  checkovIntegrationProvider,
  golangciLintIntegrationProvider
]);

assertUniqueProviderIds(PIPELINE_INTEGRATION_PROVIDERS);

export async function detectRegisteredIntegrations(
  context: IntegrationDetectionContext
): Promise<DetectedProjectIntegration[]> {
  return detectIntegrationsFromProviders(PIPELINE_INTEGRATION_PROVIDERS, context);
}

export async function detectIntegrationsFromProviders(
  providers: readonly PipelineIntegrationProvider[],
  context: IntegrationDetectionContext
): Promise<DetectedProjectIntegration[]> {
  const settled = await Promise.allSettled(providers.map(provider => provider.detect(context)));
  const results: DetectedProjectIntegration[] = [];
  for (const [index, result] of settled.entries()) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    results.push({ ...result.value, probeSupported: Boolean(providers[index].getProbe) });
  }
  return results.sort(compareIntegrations);
}

export function getRegisteredIntegrationCatalog(
  context: IntegrationDetectionContext
): ProjectIntegrationCatalogItem[] {
  return PIPELINE_INTEGRATION_PROVIDERS
    .map(provider => catalogItem(provider, context))
    .sort(compareIntegrations);
}

export function getRecommendedIntegrationCatalog(
  context: IntegrationDetectionContext,
  stackIds: readonly string[]
): ProjectIntegrationCatalogItem[] {
  const detectedStack = new Set(stackIds);
  return PIPELINE_INTEGRATION_PROVIDERS
    .filter(provider => matchesRecommendation(provider, detectedStack))
    .map(provider => catalogItem(provider, context))
    .sort(compareRecommendedIntegrations);
}

export function getRegisteredIntegrationProvider(id: string): PipelineIntegrationProvider | undefined {
  return PIPELINE_INTEGRATION_PROVIDERS.find(provider => provider.descriptor.id === id);
}

export function getRegisteredIntegrationWatchFiles(): string[] {
  const files = new Set<string>();
  for (const provider of PIPELINE_INTEGRATION_PROVIDERS) {
    for (const file of provider.watchFiles ?? []) files.add(file);
  }
  return [...files].sort((left, right) => left.localeCompare(right));
}


function catalogItem(
  provider: PipelineIntegrationProvider,
  context: IntegrationDetectionContext
): ProjectIntegrationCatalogItem {
  const setup = provider.getSetup(context);
  return {
    id: provider.descriptor.id,
    name: provider.getDisplayName?.(context) ?? provider.descriptor.displayName,
    description: provider.descriptor.description,
    category: provider.descriptor.category,
    failurePolicy: provider.descriptor.failurePolicy,
    setupHint: setup.hint,
    setupCommand: setup.command,
    probeSupported: Boolean(provider.getProbe),
    recommendationReason: provider.descriptor.recommendation?.reason,
    recommendationPriority: provider.descriptor.recommendation?.priority
  };
}

function matchesRecommendation(
  provider: PipelineIntegrationProvider,
  stackIds: ReadonlySet<string>
): boolean {
  const recommendation = provider.descriptor.recommendation;
  return Boolean(recommendation?.anyOf.some(stackId => stackIds.has(stackId)));
}

function compareRecommendedIntegrations(
  left: ProjectIntegrationCatalogItem,
  right: ProjectIntegrationCatalogItem
): number {
  return (right.recommendationPriority ?? 0) - (left.recommendationPriority ?? 0) ||
    compareIntegrations(left, right);
}

function compareIntegrations(
  left: Pick<DetectedProjectIntegration, 'category' | 'name'>,
  right: Pick<DetectedProjectIntegration, 'category' | 'name'>
): number {
  return left.category.localeCompare(right.category) || left.name.localeCompare(right.name);
}

function assertUniqueProviderIds(providers: readonly PipelineIntegrationProvider[]): void {
  const ids = new Set<string>();
  for (const provider of providers) {
    if (ids.has(provider.descriptor.id)) {
      throw new Error(`Pipeline integration provider duplicated: ${provider.descriptor.id}`);
    }
    ids.add(provider.descriptor.id);
  }
}
