import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchAllIssues,
  fetchSonarCompatibilityInfo
} from '../src/sonarClient';
import { FolderSonarConfig } from '../src/types';
import {
  discoverSonarApiCapabilities,
  parseSonarVersion,
  resolveSonarCompatibility,
  selectSonarApiProfile,
  sonarCompatibilityInfo,
  SONAR_API_PROFILES,
  translateComponentShowParameters,
  translateHotspotSearchParameters,
  translateIssueSearchParameters,
  translateProjectAnalysesParameters,
  translateProjectBranchesParameters
} from '../src/sonarApiCompatibility';

const profile25 = SONAR_API_PROFILES.find(profile => profile.id === '25x')!;
const profile26 = SONAR_API_PROFILES.find(profile => profile.id === '26x')!;

test('selecciona los perfiles 25x y 26x para sus versiones exactas', () => {
  assert.equal(selectSonarApiProfile('25.7.0.110598').profile.id, '25x');
  assert.equal(selectSonarApiProfile('26.7').profile.id, '26x');
  assert.equal(selectSonarApiProfile('2026.7').profile.id, '26x');
  assert.equal(parseSonarVersion('2025.4.1').major, 25);
});

test('usa provisionalmente el perfil más cercano para versiones antiguas y futuras', () => {
  const oldSelection = selectSonarApiProfile('24.12');
  const futureSelection = selectSonarApiProfile('27.1');

  assert.equal(oldSelection.profile.id, '25x');
  assert.equal(futureSelection.profile.id, '26x');
  assert.equal(oldSelection.provisional, true);
  assert.equal(futureSelection.provisional, true);
  assert.match(futureSelection.warning, /provisionalmente/);
});

test('usa 25x provisionalmente cuando no puede detectar la versión', () => {
  const selection = selectSonarApiProfile('');

  assert.equal(selection.profile.id, '25x');
  assert.equal(selection.provisional, true);
});

test('traduce la búsqueda de issues al contrato de 25x', () => {
  const translated = translateIssueSearchParameters(profile25, {
    componentKeys: 'project-a',
    resolved: 'false',
    p: '2',
    ps: '500',
    inNewCodePeriod: 'true'
  });

  assert.equal(translated.get('componentKeys'), 'project-a');
  assert.equal(translated.get('resolved'), 'false');
  assert.equal(translated.get('p'), '2');
  assert.equal(translated.get('inNewCodePeriod'), 'true');
  assert.equal(translated.has('components'), false);
});

test('traduce nombres y valores legacy al contrato Clean Code de 26x', () => {
  const translated = translateIssueSearchParameters(profile26, {
    componentKeys: 'project-a',
    types: 'CODE_SMELL,BUG,VULNERABILITY',
    severities: 'BLOCKER,CRITICAL,MAJOR,MINOR,INFO',
    statuses: 'OPEN,RESOLVED,CLOSED',
    facets: 'types,severities,statuses'
  });

  assert.equal(translated.get('components'), 'project-a');
  assert.equal(
    translated.get('impactSoftwareQualities'),
    'MAINTAINABILITY,RELIABILITY,SECURITY'
  );
  assert.equal(translated.get('impactSeverities'), 'BLOCKER,HIGH,MEDIUM,LOW,INFO');
  assert.equal(
    translated.get('issueStatuses'),
    'OPEN,ACCEPTED,FALSE_POSITIVE,FIXED'
  );
  assert.equal(
    translated.get('facets'),
    'impactSoftwareQualities,impactSeverities,issueStatuses'
  );
});

test('fusiona resolutions con los estados de 26x y lo conserva en 25x', () => {
  const modern = translateIssueSearchParameters(profile26, {
    statuses: 'OPEN',
    resolutions: 'WONTFIX,FALSE_POSITIVE,CLOSED'
  });
  const legacy = translateIssueSearchParameters(profile25, {
    statuses: 'OPEN',
    resolutions: 'WONTFIX'
  });

  assert.equal(
    modern.get('issueStatuses'),
    'OPEN,ACCEPTED,FALSE_POSITIVE,FIXED'
  );
  assert.equal(modern.has('resolutions'), false);
  assert.equal(legacy.get('statuses'), 'OPEN');
  assert.equal(legacy.get('resolutions'), 'WONTFIX');
});

test('convierte resolved y el proyecto de hotspots para 26x', () => {
  const issues = translateIssueSearchParameters(profile26, { resolved: 'false' });
  const hotspots = translateHotspotSearchParameters(profile26, {
    projectKey: 'project-a',
    p: '1',
    ps: '100',
    inNewCodePeriod: 'true'
  });

  assert.equal(issues.get('issueStatuses'), 'OPEN,CONFIRMED,IN_SANDBOX');
  assert.equal(issues.has('resolved'), false);
  assert.equal(hotspots.get('project'), 'project-a');
  assert.equal(hotspots.has('projectKey'), false);
});

test('prioriza parámetros y valores publicados por webservices/list', () => {
  const capabilities = discoverSonarApiCapabilities({
    webServices: [{
      path: 'api/issues',
      actions: [{
        key: 'search',
        params: [
          { key: 'components' },
          {
            key: 'issueStatuses',
            possibleValues: ['OPEN', 'CONFIRMED', 'FIXED']
          }
        ]
      }]
    }]
  });
  const translated = translateIssueSearchParameters(
    profile26,
    { componentKeys: 'project-a', resolved: 'false' },
    capabilities
  );

  assert.equal(translated.get('components'), 'project-a');
  assert.equal(translated.get('issueStatuses'), 'OPEN,CONFIRMED');
});

test('mantiene los traductores y la metadata declarativa del catálogo original', () => {
  assert.equal(
    profile26.requestTransforms['issues.types'],
    'canonicalTypesToSoftwareQualities'
  );
  assert.equal(
    profile25.responseNormalization['issue.status'],
    'canonicalStatus'
  );
  assert.equal(
    translateComponentShowParameters(profile26, { component: 'project-a' }).get('component'),
    'project-a'
  );
  assert.equal(
    translateProjectAnalysesParameters(
      profile26,
      { project: 'project-a', p: '2', ps: '100' }
    ).toString(),
    'project=project-a&p=2&ps=100'
  );
  assert.equal(
    translateProjectBranchesParameters(profile25, { project: 'project-a' }).get('project'),
    'project-a'
  );
});

test('detecta versión y capacidades una sola vez durante la vigencia de la caché', async () => {
  const requestedEndpoints: string[] = [];
  const request = async <T>(endpoint: string): Promise<T> => {
    requestedEndpoints.push(endpoint);
    if (endpoint === '/api/system/status') {
      return { version: '2026.7' } as T;
    }
    return { webServices: [] } as T;
  };

  const first = await resolveSonarCompatibility('test-cache-2026', request);
  const second = await resolveSonarCompatibility('test-cache-2026', request);

  assert.equal(first.selection.profile.id, '26x');
  assert.equal(first.version.major, 26);
  assert.deepEqual(sonarCompatibilityInfo(first), {
    version: '2026.7',
    major: 26,
    minor: 7,
    profile: '26x',
    profileGeneration: 'V26',
    appliedProfiles: ['26x'],
    fallbackApplied: false,
    provisional: false,
    warning: '',
    cleanCodeParameters: true,
    capabilitiesAvailable: true
  });
  assert.strictEqual(second, first);
  assert.deepEqual(requestedEndpoints.sort(), [
    '/api/system/status',
    '/api/webservices/list'
  ]);
});

test('reintenta con 25x y recuerda el perfil cuando 26x rechaza sus parámetros', async () => {
  const originalFetch = globalThis.fetch;
  const issueQueries: string[] = [];
  const json = (value: unknown, status = 200): Response => new Response(
    JSON.stringify(value),
    {
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
  globalThis.fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === '/api/system/status') {
      return json({ version: '26.7', status: 'UP' });
    }
    if (url.pathname === '/api/webservices/list') {
      return json({ errors: [{ msg: 'Not found' }] }, 404);
    }
    if (url.pathname === '/api/issues/search') {
      issueQueries.push(url.search);
      if (url.searchParams.has('components')) {
        return json({ errors: [{ msg: 'Unknown parameter components' }] }, 400);
      }
      return json({ issues: [], components: [], paging: { total: 0 } });
    }
    if (url.pathname === '/api/hotspots/search') {
      return json({ hotspots: [], paging: { total: 0 } });
    }
    if (url.pathname === '/api/settings/values') {
      return json({ settings: [] });
    }
    if (url.pathname === '/api/measures/search_history') {
      return json({ measures: [] });
    }
    if (url.pathname === '/api/qualitygates/project_status') {
      return json({});
    }
    if (url.pathname === '/api/measures/component') {
      return json({ component: { measures: [] } });
    }
    if (url.pathname === '/api/measures/component_tree') {
      return json({ components: [], paging: { total: 0 } });
    }
    throw new Error(`Petición inesperada en la prueba: ${url}`);
  };

  const config: FolderSonarConfig = {
    serverUrl: 'http://sonar-fallback.test',
    projectKey: 'project-a',
    projectName: 'Project A',
    token: 'test-token',
    scannerMode: 'auto'
  };

  try {
    await fetchAllIssues(config);
    const queriesAfterFirstLoad = issueQueries.length;
    await fetchAllIssues(config);
    const appliedCompatibility = await fetchSonarCompatibilityInfo(
      config.serverUrl,
      config.token
    );

    assert.ok(issueQueries.some(query => query.includes('components=project-a')));
    assert.ok(issueQueries.some(query => query.includes('componentKeys=project-a')));
    assert.ok(issueQueries.length > queriesAfterFirstLoad);
    assert.ok(
      issueQueries
        .slice(queriesAfterFirstLoad)
        .every(query =>
          query.includes('componentKeys=project-a') && !query.includes('components=')
        )
    );
    assert.equal(appliedCompatibility.fallbackApplied, true);
    assert.deepEqual(appliedCompatibility.appliedProfiles, ['26x', '25x']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('vuelve a detectar la versión cuando cambia el token del mismo servidor', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const authorization = new Headers(init?.headers).get('Authorization');
    const version = authorization === 'Bearer second-token' ? '26.7' : '25.7';
    return new Response(JSON.stringify({ version, webServices: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const first = await fetchSonarCompatibilityInfo(
      'http://sonar-token-change.test',
      'first-token'
    );
    const second = await fetchSonarCompatibilityInfo(
      'http://sonar-token-change.test',
      'second-token'
    );

    assert.equal(first.profile, '25x');
    assert.equal(second.profile, '26x');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
