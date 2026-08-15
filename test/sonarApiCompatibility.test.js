"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const sonarApiCompatibility_1 = require("../src/sonarApiCompatibility");
const profile25 = sonarApiCompatibility_1.SONAR_API_PROFILES.find(profile => profile.id === '25x');
const profile26 = sonarApiCompatibility_1.SONAR_API_PROFILES.find(profile => profile.id === '26x');
test('selecciona los perfiles 25x y 26x para sus versiones exactas', () => {
    assert.equal((0, sonarApiCompatibility_1.selectSonarApiProfile)('25.7.0.110598').profile.id, '25x');
    assert.equal((0, sonarApiCompatibility_1.selectSonarApiProfile)('26.7').profile.id, '26x');
    assert.equal((0, sonarApiCompatibility_1.selectSonarApiProfile)('2026.7').profile.id, '26x');
    assert.equal((0, sonarApiCompatibility_1.parseSonarVersion)('2025.4.1').major, 25);
});
test('usa provisionalmente el perfil más cercano para versiones antiguas y futuras', () => {
    const oldSelection = (0, sonarApiCompatibility_1.selectSonarApiProfile)('24.12');
    const futureSelection = (0, sonarApiCompatibility_1.selectSonarApiProfile)('27.1');
    assert.equal(oldSelection.profile.id, '25x');
    assert.equal(futureSelection.profile.id, '26x');
    assert.equal(oldSelection.provisional, true);
    assert.equal(futureSelection.provisional, true);
    assert.match(futureSelection.warning, /provisionalmente/);
});
test('usa 25x provisionalmente cuando no puede detectar la versión', () => {
    const selection = (0, sonarApiCompatibility_1.selectSonarApiProfile)('');
    assert.equal(selection.profile.id, '25x');
    assert.equal(selection.provisional, true);
});
test('traduce la búsqueda de issues al contrato de 25x', () => {
    const translated = (0, sonarApiCompatibility_1.translateIssueSearchParameters)(profile25, {
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
    const translated = (0, sonarApiCompatibility_1.translateIssueSearchParameters)(profile26, {
        componentKeys: 'project-a',
        types: 'CODE_SMELL,BUG,VULNERABILITY',
        severities: 'BLOCKER,CRITICAL,MAJOR,MINOR,INFO',
        statuses: 'OPEN,RESOLVED,CLOSED',
        facets: 'types,severities,statuses'
    });
    assert.equal(translated.get('components'), 'project-a');
    assert.equal(translated.get('impactSoftwareQualities'), 'MAINTAINABILITY,RELIABILITY,SECURITY');
    assert.equal(translated.get('impactSeverities'), 'BLOCKER,HIGH,MEDIUM,LOW,INFO');
    assert.equal(translated.get('issueStatuses'), 'OPEN,ACCEPTED,FALSE_POSITIVE,FIXED');
    assert.equal(translated.get('facets'), 'impactSoftwareQualities,impactSeverities,issueStatuses');
});
test('convierte resolved y el proyecto de hotspots para 26x', () => {
    const issues = (0, sonarApiCompatibility_1.translateIssueSearchParameters)(profile26, { resolved: 'false' });
    const hotspots = (0, sonarApiCompatibility_1.translateHotspotSearchParameters)(profile26, {
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
    const capabilities = (0, sonarApiCompatibility_1.discoverSonarApiCapabilities)({
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
    const translated = (0, sonarApiCompatibility_1.translateIssueSearchParameters)(profile26, { componentKeys: 'project-a', resolved: 'false' }, capabilities);
    assert.equal(translated.get('components'), 'project-a');
    assert.equal(translated.get('issueStatuses'), 'OPEN,CONFIRMED');
});
//# sourceMappingURL=sonarApiCompatibility.test.js.map