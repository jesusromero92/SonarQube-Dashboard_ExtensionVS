"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const sonarApiCompatibility_1 = require("../src/sonarApiCompatibility");
const profile25 = sonarApiCompatibility_1.SONAR_API_PROFILES.find(profile => profile.id === '25x');
const profile26 = sonarApiCompatibility_1.SONAR_API_PROFILES.find(profile => profile.id === '26x');
(0, node_test_1.default)('selecciona los perfiles 25x y 26x para sus versiones exactas', () => {
    strict_1.default.equal((0, sonarApiCompatibility_1.selectSonarApiProfile)('25.7.0.110598').profile.id, '25x');
    strict_1.default.equal((0, sonarApiCompatibility_1.selectSonarApiProfile)('26.7').profile.id, '26x');
    strict_1.default.equal((0, sonarApiCompatibility_1.selectSonarApiProfile)('2026.7').profile.id, '26x');
    strict_1.default.equal((0, sonarApiCompatibility_1.parseSonarVersion)('2025.4.1').major, 25);
});
(0, node_test_1.default)('usa provisionalmente el perfil más cercano para versiones antiguas y futuras', () => {
    const oldSelection = (0, sonarApiCompatibility_1.selectSonarApiProfile)('24.12');
    const futureSelection = (0, sonarApiCompatibility_1.selectSonarApiProfile)('27.1');
    strict_1.default.equal(oldSelection.profile.id, '25x');
    strict_1.default.equal(futureSelection.profile.id, '26x');
    strict_1.default.equal(oldSelection.provisional, true);
    strict_1.default.equal(futureSelection.provisional, true);
    strict_1.default.match(futureSelection.warning, /provisionalmente/);
});
(0, node_test_1.default)('usa 25x provisionalmente cuando no puede detectar la versión', () => {
    const selection = (0, sonarApiCompatibility_1.selectSonarApiProfile)('');
    strict_1.default.equal(selection.profile.id, '25x');
    strict_1.default.equal(selection.provisional, true);
});
(0, node_test_1.default)('traduce la búsqueda de issues al contrato de 25x', () => {
    const translated = (0, sonarApiCompatibility_1.translateIssueSearchParameters)(profile25, {
        componentKeys: 'project-a',
        resolved: 'false',
        p: '2',
        ps: '500',
        inNewCodePeriod: 'true'
    });
    strict_1.default.equal(translated.get('componentKeys'), 'project-a');
    strict_1.default.equal(translated.get('resolved'), 'false');
    strict_1.default.equal(translated.get('p'), '2');
    strict_1.default.equal(translated.get('inNewCodePeriod'), 'true');
    strict_1.default.equal(translated.has('components'), false);
});
(0, node_test_1.default)('traduce nombres y valores legacy al contrato Clean Code de 26x', () => {
    const translated = (0, sonarApiCompatibility_1.translateIssueSearchParameters)(profile26, {
        componentKeys: 'project-a',
        types: 'CODE_SMELL,BUG,VULNERABILITY',
        severities: 'BLOCKER,CRITICAL,MAJOR,MINOR,INFO',
        statuses: 'OPEN,RESOLVED,CLOSED',
        facets: 'types,severities,statuses'
    });
    strict_1.default.equal(translated.get('components'), 'project-a');
    strict_1.default.equal(translated.get('impactSoftwareQualities'), 'MAINTAINABILITY,RELIABILITY,SECURITY');
    strict_1.default.equal(translated.get('impactSeverities'), 'BLOCKER,HIGH,MEDIUM,LOW,INFO');
    strict_1.default.equal(translated.get('issueStatuses'), 'OPEN,ACCEPTED,FALSE_POSITIVE,FIXED');
    strict_1.default.equal(translated.get('facets'), 'impactSoftwareQualities,impactSeverities,issueStatuses');
});
(0, node_test_1.default)('convierte resolved y el proyecto de hotspots para 26x', () => {
    const issues = (0, sonarApiCompatibility_1.translateIssueSearchParameters)(profile26, { resolved: 'false' });
    const hotspots = (0, sonarApiCompatibility_1.translateHotspotSearchParameters)(profile26, {
        projectKey: 'project-a',
        p: '1',
        ps: '100',
        inNewCodePeriod: 'true'
    });
    strict_1.default.equal(issues.get('issueStatuses'), 'OPEN,CONFIRMED,IN_SANDBOX');
    strict_1.default.equal(issues.has('resolved'), false);
    strict_1.default.equal(hotspots.get('project'), 'project-a');
    strict_1.default.equal(hotspots.has('projectKey'), false);
});
(0, node_test_1.default)('prioriza parámetros y valores publicados por webservices/list', () => {
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
    strict_1.default.equal(translated.get('components'), 'project-a');
    strict_1.default.equal(translated.get('issueStatuses'), 'OPEN,CONFIRMED');
});
//# sourceMappingURL=sonarApiCompatibility.test.js.map