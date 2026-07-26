export const ISSUE_DIALOG_SCRIPT = `    let selectedManagedIssue = null;
    let currentLifecycleDetail = null;
    let selectedFlowIndex = 0;
    let selectedFlowLocationIndex = 0;

    function transitionLabel(transition) {
      const labels = {
        accept: 'Aceptar',
        falsepositive: 'Marcar como falso positivo',
        wontfix: 'Marcar como no se corregirá',
        reopen: 'Reabrir',
        resolve: 'Resolver',
        confirm: 'Confirmar'
      };
      return labels[String(transition.key || '').toLowerCase()] || transition.name || transition.key;
    }

    function issueStatus(issue) {
      return String(issue.status || 'OPEN').toUpperCase();
    }

    function currentTransitionForStatus(status) {
      return {
        ACCEPTED: 'accept',
        FALSE_POSITIVE: 'falsepositive',
        CONFIRMED: 'confirm',
        FIXED: 'resolve'
      }[String(status || '').toUpperCase()] || '';
    }

    function renderIssueBadges(issue) {
      elements.issueDialogBadges.textContent = '';
      elements.issueDialogBadges.appendChild(createBadge(issue.severity));
      const status = document.createElement('span');
      status.className = 'status-chip';
      status.textContent = issueStatus(issue);
      elements.issueDialogBadges.appendChild(status);
    }

    function formatLifecycleDate(value) {
      if (!value) return 'No disponible';
      const date = new Date(value);
      return Number.isFinite(date.getTime())
        ? new Intl.DateTimeFormat(dashboardLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
        : String(value);
    }

    function appendDetailTerm(list, term, value) {
      const dt = document.createElement('dt');
      dt.textContent = term;
      const dd = document.createElement('dd');
      dd.textContent = value || 'No disponible';
      list.append(dt, dd);
    }

    function showIssueLifecycleDialog(issue) {
      selectedManagedIssue = issue;
      currentLifecycleDetail = null;
      selectedFlowIndex = 0;
      selectedFlowLocationIndex = 0;
      elements.issueDialogTitle.textContent = issue.ruleName || issue.rule || 'Gestión del defecto';
      renderIssueBadges(issue);
      elements.issueDialogLoading.textContent = 'Cargando gestión del defecto…';
      elements.issueDialogLoading.hidden = false;
      elements.issueDialogContent.hidden = true;
      if (!elements.issueDialog.open) elements.issueDialog.showModal();
      vscode.postMessage({
        type: 'loadIssueLifecycle',
        issueKey: issue.key,
        folderUri: issue.folderUri,
        flowIndex: selectedFlowIndex
      });
    }

    function renderLifecycleActivity(container, items, emptyText, renderer) {
      container.textContent = '';
      if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = emptyText;
        container.appendChild(empty);
        return;
      }
      for (const item of items) container.appendChild(renderer(item));
    }

    function renderIssueFlows(issue) {
      const flows = issue.flows?.length
        ? issue.flows
        : (issue.secondaryLocations?.length ? [{ index: 0, locations: issue.secondaryLocations }] : []);
      elements.issueFlowSection.hidden = flows.length === 0;
      elements.issueFlowSelect.textContent = '';
      if (!flows.length) return;
      selectedFlowIndex = Math.min(selectedFlowIndex, flows.length - 1);
      flows.forEach((flow, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = 'Flujo ' + String(index + 1) + ' · ' + String(flow.locations.length) + ' ubicaciones';
        elements.issueFlowSelect.appendChild(option);
      });
      elements.issueFlowSelect.value = String(selectedFlowIndex);
      const locations = flows[selectedFlowIndex].locations || [];
      selectedFlowLocationIndex = Math.min(selectedFlowLocationIndex, Math.max(0, locations.length - 1));
      elements.issueFlowLocations.textContent = '';
      locations.forEach((location, index) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'flow-location' + (index === selectedFlowLocationIndex ? ' active' : '');
        const role = document.createElement('strong');
        role.textContent = location.role === 'source'
          ? 'Source'
          : location.role === 'sink'
            ? 'Sink'
            : location.role === 'intermediate'
              ? 'Paso intermedio'
              : 'Ubicación relacionada';
        const path = document.createElement('span');
        path.textContent = location.relativePath + ':' + location.line +
          (location.resolved ? '' : ' · No disponible localmente');
        const message = document.createElement('small');
        message.textContent = location.message || '';
        button.append(role, path, message);
        button.addEventListener('click', () => {
          selectedFlowLocationIndex = index;
          renderIssueFlows(issue);
          vscode.postMessage({
            type: 'selectFlowLocation',
            issueKey: issue.key,
            flowIndex: selectedFlowIndex,
            locationIndex: index
          });
        });
        item.appendChild(button);
        elements.issueFlowLocations.appendChild(item);
      });
    }

    function renderIssueLifecycle(detail) {
      currentLifecycleDetail = detail;
      selectedManagedIssue = detail.issue;
      const issue = detail.issue;
      elements.issueDialogLoading.hidden = true;
      elements.issueDialogContent.hidden = false;
      elements.issueDialogTitle.textContent = issue.ruleName || issue.rule;
      renderIssueBadges(issue);
      elements.issueDialogMessage.textContent = issue.message;
      elements.issueDialogMeta.textContent = '';
      appendDetailTerm(elements.issueDialogMeta, 'Estado', issueStatus(issue));
      appendDetailTerm(elements.issueDialogMeta, 'Responsable', issue.assignee || 'Sin asignar');
      appendDetailTerm(elements.issueDialogMeta, 'Autor', issue.author);
      appendDetailTerm(elements.issueDialogMeta, 'Creado', formatLifecycleDate(issue.creationDate));
      appendDetailTerm(elements.issueDialogMeta, 'Actualizado', formatLifecycleDate(issue.updateDate));
      appendDetailTerm(elements.issueDialogMeta, 'Archivo', issue.relativePath + ':' + issue.line);

      elements.issueTransitionActions.textContent = '';
      const currentTransition = currentTransitionForStatus(issueStatus(issue));
      let currentTransitionRendered = false;
      for (const transition of detail.transitions || []) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary';
        button.textContent = transitionLabel(transition);
        button.disabled = String(transition.key || '').toLowerCase() === currentTransition;
        if (button.disabled) {
          button.title = 'Estado actual';
          button.setAttribute('aria-current', 'true');
          currentTransitionRendered = true;
        }
        button.addEventListener('click', () => vscode.postMessage({
          type: 'mutateIssue',
          mutationKind: 'transition',
          issueKey: issue.key,
          folderUri: issue.folderUri,
          transition: transition.key
        }));
        elements.issueTransitionActions.appendChild(button);
      }
      if (currentTransition && !currentTransitionRendered) {
        const currentButton = document.createElement('button');
        currentButton.type = 'button';
        currentButton.className = 'secondary';
        currentButton.textContent = transitionLabel({ key: currentTransition });
        currentButton.disabled = true;
        currentButton.title = 'Estado actual';
        currentButton.setAttribute('aria-current', 'true');
        elements.issueTransitionActions.prepend(currentButton);
      }
      elements.issueActionsSection.hidden = !(detail.transitions?.length || detail.canAssign || detail.canComment);
      if (!detail.transitions?.length) {
        const noTransitions = document.createElement('span');
        noTransitions.className = 'muted';
        noTransitions.textContent = 'El token no dispone de transiciones de estado para este defecto.';
        elements.issueTransitionActions.appendChild(noTransitions);
      }

      elements.issueAssignment.hidden = !detail.canAssign;
      elements.issueAssigneeSearch.value = '';
      renderAssignableUsers(detail.users || [], issue.assignee || '');
      elements.issueCommentForm.hidden = !detail.canComment;
      elements.issueComment.value = '';

      renderIssueFlows(issue);
      elements.issueCommentsCount.textContent = String((detail.comments || []).length);
      elements.issueHistoryCount.textContent = String((detail.history || []).length);
      renderLifecycleActivity(
        elements.issueComments,
        detail.comments || [],
        'No hay comentarios.',
        comment => {
          const card = document.createElement('article');
          card.className = 'activity-item';
          const heading = document.createElement('strong');
          heading.textContent = comment.user || 'SonarQube';
          const date = document.createElement('time');
          date.textContent = formatLifecycleDate(comment.createdAt);
          const text = document.createElement('p');
          text.textContent = comment.text;
          card.append(heading, date, text);
          return card;
        }
      );
      renderLifecycleActivity(
        elements.issueHistory,
        detail.history || [],
        'No hay historial disponible.',
        entry => {
          const card = document.createElement('article');
          card.className = 'activity-item';
          const heading = document.createElement('strong');
          heading.textContent = entry.user || 'SonarQube';
          const date = document.createElement('time');
          date.textContent = formatLifecycleDate(entry.date);
          card.append(heading, date);
          for (const change of entry.changes || []) {
            const text = document.createElement('p');
            text.textContent = change.field + ': ' + (change.oldValue || '—') + ' → ' + (change.newValue || '—');
            card.appendChild(text);
          }
          return card;
        }
      );
    }

    function renderAssignableUsers(users, selectedLogin) {
      const query = String(elements.issueAssigneeSearch.value || '')
        .trim()
        .toLocaleLowerCase(dashboardLocale);
      elements.issueAssignee.textContent = '';
      const unassigned = document.createElement('option');
      unassigned.value = '';
      unassigned.textContent = 'Sin asignar';
      elements.issueAssignee.appendChild(unassigned);
      for (const user of users) {
        const searchable = String((user.name || '') + ' ' + user.login)
          .toLocaleLowerCase(dashboardLocale);
        if (query && !searchable.includes(query) && user.login !== selectedLogin) {
          continue;
        }
        const option = document.createElement('option');
        option.value = user.login;
        option.textContent = (user.name || user.login) + (user.name ? ' · ' + user.login : '');
        elements.issueAssignee.appendChild(option);
      }
      elements.issueAssignee.value = selectedLogin;
    }

    function setIssueLifecycleError(message) {
      elements.issueDialogLoading.textContent = message || 'No se pudo cargar la gestión del defecto.';
      elements.issueDialogLoading.hidden = false;
      elements.issueDialogContent.hidden = true;
    }
`;
