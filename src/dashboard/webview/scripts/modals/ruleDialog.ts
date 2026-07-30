export const RULE_DIALOG_SCRIPT = `    function rulePlainText(value) {
      if (!value) return '';
      return new DOMParser()
        .parseFromString(String(value), 'text/html')
        .body.textContent
        ?.trim() || '';
    }

    function appendRuleMeta(container, label, value, layout) {
      if (!value || !container) return;
      const item = document.createElement('div');
      item.className = 'rule-meta-item';
      if (layout === 'full') {
        item.classList.add('rule-meta-item-full');
      }

      const term = document.createElement('span');
      term.className = 'rule-meta-label';
      term.textContent = label;

      const content = document.createElement('span');
      content.className = 'rule-meta-value';
      if (value instanceof Node) {
        content.appendChild(value);
      } else {
        content.textContent = String(value);
      }

      item.append(term, content);
      container.appendChild(item);
    }

    function appendDefinitionListItem(list, label, value) {
      if (!value) return;
      const term = document.createElement('dt');
      term.textContent = label;
      const description = document.createElement('dd');
      description.textContent = value;
      list.append(term, description);
    }

    function setRuleSection(section, hasContent) {
      section.hidden = !hasContent;
    }

    function normalizedRuleType(type) {
      return String(type || '').trim().toUpperCase();
    }

    function ruleTypeLabel(type) {
      const normalized = normalizedRuleType(type);
      const translated = dashboardMessages.ruleDetail.issueTypes[normalized];
      return translated || normalized.replace(/_/g, ' ');
    }

    function createRuleTypeValue(type) {
      const normalized = normalizedRuleType(type);
      if (!normalized) return null;

      const value = document.createElement('span');
      value.className = 'rule-type-value';

      const iconClass = typeIconClasses[normalized];
      if (iconClass) {
        const icon = document.createElement('span');
        icon.className = 'type-icon ' + iconClass;
        icon.setAttribute('role', 'img');
        icon.setAttribute('aria-label', ruleTypeLabel(normalized));
        value.appendChild(icon);
      }

      const label = document.createElement('span');
      label.textContent = ruleTypeLabel(normalized);
      value.appendChild(label);
      return value;
    }

    function configuredBranch() {
      const draftBranch = elements.branch?.value?.trim();
      const savedBranch = currentConfig.branch?.trim();
      return draftBranch || savedBranch || dashboardMessages.ruleDetail.mainBranch;
    }

    function renderRuleParameters(detail) {
      elements.ruleDialogParameters.textContent = '';
      const parameters = Array.isArray(detail.parameters)
        ? detail.parameters
        : [];
      setRuleSection(
        elements.ruleDialogParametersSection,
        parameters.length > 0
      );

      for (const parameter of parameters) {
        const item = document.createElement('article');
        item.className = 'rule-parameter-item';

        const title = document.createElement('strong');
        title.textContent = parameter.key;
        item.appendChild(title);

        const description = rulePlainText(parameter.description);
        if (description) {
          const text = document.createElement('p');
          text.textContent = description;
          item.appendChild(text);
        }

        const metadata = document.createElement('dl');
        metadata.className = 'rule-parameter-meta';
        appendDefinitionListItem(
          metadata,
          dashboardMessages.ruleDetail.defaultValue,
          parameter.defaultValue
        );
        appendDefinitionListItem(
          metadata,
          dashboardMessages.ruleDetail.parameterType,
          parameter.type
        );
        if (metadata.childElementCount > 0) {
          item.appendChild(metadata);
        }

        elements.ruleDialogParameters.appendChild(item);
      }
    }

    function showRuleDialog(issue) {
      selectedRuleIssue = issue;
      elements.ruleDialogTitle.textContent =
        issue.ruleName ||
        issue.rule ||
        dashboardMessages.ruleDetail.title;
      elements.ruleDialogLoading.textContent =
        dashboardMessages.ruleDetail.loading;
      elements.ruleDialogLoading.hidden = false;
      elements.ruleDialogContent.hidden = true;
      elements.openRuleFile.disabled = !issue.fileUri;

      if (!elements.ruleDialog.open) {
        elements.ruleDialog.showModal();
      }

      vscode.postMessage({
        type: 'loadRuleDetail',
        ruleKey: issue.rule,
        folderUri: issue.folderUri
      });
    }

    function renderRuleDetail(detail) {
      elements.ruleDialogLoading.hidden = true;
      elements.ruleDialogContent.hidden = false;
      elements.ruleDialogTitle.textContent =
        detail.name ||
        detail.key ||
        selectedRuleIssue?.ruleName ||
        selectedRuleIssue?.rule ||
        dashboardMessages.ruleDetail.title;

      elements.ruleDialogMeta.textContent = '';
      elements.ruleDialogLocationMeta.textContent = '';
      appendRuleMeta(elements.ruleDialogMeta, dashboardMessages.ruleDetail.key, detail.key);
      appendRuleMeta(
        elements.ruleDialogMeta,
        dashboardMessages.ruleDetail.language,
        detail.languageName || detail.language
      );
      appendRuleMeta(elements.ruleDialogMeta, dashboardMessages.ruleDetail.status, detail.status);
      appendRuleMeta(
        elements.ruleDialogMeta,
        dashboardMessages.ruleDetail.severity,
        detail.severity ? createBadge(detail.severity) : null
      );
      appendRuleMeta(
        elements.ruleDialogMeta,
        dashboardMessages.ruleDetail.type,
        createRuleTypeValue(detail.type)
      );
      appendRuleMeta(
        elements.ruleDialogMeta,
        dashboardMessages.ruleDetail.branch,
        configuredBranch()
      );
      appendRuleMeta(
        elements.ruleDialogMeta,
        dashboardMessages.ruleDetail.category,
        detail.cleanCodeAttributeCategory
      );
      appendRuleMeta(
        elements.ruleDialogMeta,
        dashboardMessages.ruleDetail.created,
        detail.createdAt
          ? new Date(detail.createdAt).toLocaleString(dashboardLocale)
          : ''
      );
      appendRuleMeta(
        elements.ruleDialogMeta,
        dashboardMessages.ruleDetail.updated,
        detail.updatedAt
          ? new Date(detail.updatedAt).toLocaleString(dashboardLocale)
          : ''
      );
      appendRuleMeta(
        elements.ruleDialogMeta,
        dashboardMessages.ruleDetail.occurrences,
        String(
          currentIssues.filter(issue => issue.rule === detail.key).length
        )
      );
      appendRuleMeta(
        elements.ruleDialogMeta,
        dashboardMessages.ruleDetail.remediationEffort,
        detail.remediation?.baseEffort ||
          dashboardMessages.ruleDetail.notAvailable
      );

      appendRuleMeta(
        elements.ruleDialogLocationMeta,
        dashboardMessages.ruleDetail.file,
        selectedRuleIssue?.relativePath,
        'full'
      );
      appendRuleMeta(
        elements.ruleDialogLocationMeta,
        dashboardMessages.ruleDetail.line,
        selectedRuleIssue?.line ? String(selectedRuleIssue.line) : '',
        'full'
      );

      elements.ruleDialogDescription.textContent =
        rulePlainText(detail.description) ||
        selectedRuleIssue?.message ||
        dashboardMessages.ruleDetail.noDescription;

      const note = rulePlainText(detail.note);
      elements.ruleDialogNote.textContent = note;
      setRuleSection(elements.ruleDialogNoteSection, Boolean(note));

      renderRuleParameters(detail);
    }

    function setRuleDetailError(message) {
      elements.ruleDialogLoading.textContent =
        message ||
        dashboardMessages.ruleDetail.loadError;
      elements.ruleDialogLoading.hidden = false;
      elements.ruleDialogContent.hidden = true;
    }

`;
