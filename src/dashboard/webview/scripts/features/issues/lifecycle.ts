export const ISSUE_LIFECYCLE_SCRIPT = `
    function showIssueLifecycleDialog(issue) {
      selectedManagedIssue = issue;
      selectedFlowIndex = 0;
      selectedFlowLocationIndex = 0;
      elements.issueDialogTitle.textContent =
        issue.ruleName ||
        issue.rule ||
        'Gestión del defecto';
      renderIssueBadges(issue);
      elements.issueDialogLoading.textContent =
        'Cargando gestión del defecto…';
      elements.issueDialogLoading.hidden = false;
      elements.issueDialogContent.hidden = true;

      if (!elements.issueDialog.open) {
        elements.issueDialog.showModal();
      }

      vscode.postMessage({
        type: 'loadIssueLifecycle',
        issueKey: issue.key,
        folderUri: issue.folderUri,
        flowIndex: selectedFlowIndex
      });
    }

    function renderIssueLifecycle(detail) {
      selectedManagedIssue = detail.issue;
      const issue = detail.issue;

      elements.issueDialogLoading.hidden = true;
      elements.issueDialogContent.hidden = false;
      elements.issueDialogTitle.textContent = issue.ruleName || issue.rule;
      renderIssueBadges(issue);
      elements.issueDialogMessage.textContent = issue.message;
      elements.issueDialogMeta.textContent = '';

      appendDetailTerm(
        elements.issueDialogMeta,
        'Estado',
        issueStatus(issue)
      );
      appendDetailTerm(
        elements.issueDialogMeta,
        'Responsable',
        issue.assignee || 'Sin asignar'
      );
      appendDetailTerm(
        elements.issueDialogMeta,
        'Autor',
        issue.author
      );
      appendDetailTerm(
        elements.issueDialogMeta,
        'Creado',
        formatLifecycleDate(issue.creationDate)
      );
      appendDetailTerm(
        elements.issueDialogMeta,
        'Actualizado',
        formatLifecycleDate(issue.updateDate)
      );
      appendDetailTerm(
        elements.issueDialogMeta,
        'Archivo',
        issue.relativePath + ':' + issue.line
      );

      renderIssueActions(detail, issue);
      renderIssueFlows(issue);
      renderIssueActivity(detail);
    }

    function setIssueLifecycleError(message) {
      elements.issueDialogLoading.textContent =
        message ||
        'No se pudo cargar la gestión del defecto.';
      elements.issueDialogLoading.hidden = false;
      elements.issueDialogContent.hidden = true;
    }
`;
