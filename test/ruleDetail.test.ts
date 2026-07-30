import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchRuleDetail } from '../src/sonarClient';
import {
  FolderSonarConfig
} from '../src/types';
import { RULE_DIALOG_MARKUP } from '../src/dashboard/webview/modals/ruleDialog';
import { RULE_DIALOG_SCRIPT } from '../src/dashboard/webview/scripts/modals/ruleDialog';
import { MESSAGE_EVENTS_SCRIPT } from '../src/dashboard/webview/scripts/events/messages';

const config: FolderSonarConfig = {
  serverUrl: 'https://sonarqube.example.test',
  projectKey: 'sample',
  projectName: 'Sample',
  token: 'token',
  scannerMode: 'auto'
};

test('fetchRuleDetail normaliza toda la información disponible de la regla', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';

  globalThis.fetch = (async input => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      rule: {
        key: 'typescript:S6606',
        repo: 'typescript',
        name: 'Nullish coalescing should be preferred',
        htmlDesc: '<p>Use the safer operator.</p>',
        htmlNote: '<p>Team note</p>',
        severity: 'MINOR',
        status: 'READY',
        type: 'CODE_SMELL',
        lang: 'ts',
        langName: 'TypeScript',
        scope: 'MAIN',
        cleanCodeAttribute: 'CONVENTIONAL',
        cleanCodeAttributeCategory: 'CONSISTENT',
        impacts: [
          { softwareQuality: 'MAINTAINABILITY', severity: 'LOW' }
        ],
        params: [
          {
            key: 'threshold',
            htmlDesc: 'Allowed threshold',
            defaultValue: '15',
            type: 'INTEGER'
          }
        ],
        tags: ['readability'],
        sysTags: ['typescript'],
        remFnType: 'CONSTANT_ISSUE',
        remFnBaseEffort: '5min',
        gapDescription: 'Per issue'
      },
      actives: [
        {
          qProfile: 'Sonar way',
          inherit: 'NONE',
          severity: 'MINOR'
        }
      ]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }) as typeof fetch;

  try {
    const detail = await fetchRuleDetail(config, 'typescript:S6606');

    assert.match(requestedUrl, /\/api\/rules\/show/);
    assert.match(requestedUrl, /key=typescript%3AS6606/);
    assert.match(requestedUrl, /actives=true/);
    assert.equal(detail.name, 'Nullish coalescing should be preferred');
    assert.equal(detail.description, '<p>Use the safer operator.</p>');
    assert.equal(detail.note, '<p>Team note</p>');
    assert.equal(detail.impacts[0]?.softwareQuality, 'MAINTAINABILITY');
    assert.equal(detail.parameters[0]?.defaultValue, '15');
    assert.deepEqual(detail.tags, ['readability', 'typescript']);
    assert.equal(detail.activeProfiles[0]?.profile, 'Sonar way');
    assert.equal(detail.remediation.baseEffort, '5min');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('el diálogo de reglas carga y presenta el detalle remoto', () => {
  assert.match(RULE_DIALOG_MARKUP, /ruleDialogLoading/);
  assert.doesNotMatch(RULE_DIALOG_MARKUP, /ruleDialogRemediation/);
  assert.match(RULE_DIALOG_MARKUP, /ruleDialogParameters/);
  assert.match(RULE_DIALOG_MARKUP, /Ubicación/);
  assert.match(RULE_DIALOG_MARKUP, /Detalles/);
  assert.match(RULE_DIALOG_MARKUP, /ruleDialogLocationMeta/);
  assert.doesNotMatch(RULE_DIALOG_MARKUP, /ruleDialogImpacts/);
  assert.doesNotMatch(RULE_DIALOG_MARKUP, /ruleDialogTags/);
  assert.doesNotMatch(RULE_DIALOG_MARKUP, /ruleDialogProfiles/);
  assert.match(RULE_DIALOG_SCRIPT, /type: 'loadRuleDetail'/);
  assert.match(RULE_DIALOG_SCRIPT, /renderRuleDetail/);
  assert.match(RULE_DIALOG_SCRIPT, /createRuleTypeValue/);
  assert.match(RULE_DIALOG_SCRIPT, /createBadge\(detail\.severity\)/);
  assert.doesNotMatch(RULE_DIALOG_SCRIPT, /renderRuleBadges/);
  assert.doesNotMatch(RULE_DIALOG_SCRIPT, /cleanCodeAttribute,/);
  assert.match(RULE_DIALOG_SCRIPT, /ruleDetail\.remediationEffort/);
  assert.match(RULE_DIALOG_SCRIPT, /detail\.remediation\?\.baseEffort/);
  assert.match(RULE_DIALOG_SCRIPT, /ruleDetail\.line/);
  assert.match(RULE_DIALOG_SCRIPT, /rule-meta-item-full/);
  assert.match(RULE_DIALOG_SCRIPT, /ruleDialogLocationMeta/);
  assert.match(RULE_DIALOG_SCRIPT, /dashboardMessages\.ruleDetail\.branch/);
  assert.match(RULE_DIALOG_SCRIPT, /dashboardMessages\.ruleDetail\.file/);
  assert.doesNotMatch(RULE_DIALOG_SCRIPT, /renderRuleImpacts/);
  assert.doesNotMatch(RULE_DIALOG_SCRIPT, /renderRuleTags/);
  assert.doesNotMatch(RULE_DIALOG_SCRIPT, /renderRuleProfiles/);
  assert.match(MESSAGE_EVENTS_SCRIPT, /case 'ruleDetail'/);
  assert.match(MESSAGE_EVENTS_SCRIPT, /case 'ruleDetailError'/);
});
