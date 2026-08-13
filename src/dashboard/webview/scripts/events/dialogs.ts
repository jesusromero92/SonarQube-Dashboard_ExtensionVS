export const DIALOG_EVENTS_SCRIPT = `
    function bindDialogDismiss(dialog, closeButtons = []) {
      const close = () => {
        if (dialog.open) {
          dialog.close();
        }
      };

      for (const button of closeButtons) {
        button.addEventListener('click', close);
      }

      dialog.addEventListener('click', event => {
        if (event.target === dialog) {
          close();
        }
      });

      return close;
    }

    bindDialogDismiss(
      elements.issueFiltersDialog,
      [elements.issueFiltersDialogClose]
    );

    bindDialogDismiss(
      elements.ruleDialog,
      [
        elements.ruleDialogClose,
        elements.closeRuleDialog
      ]
    );
    elements.openRuleFile.addEventListener('click', () => {
      if (!selectedRuleIssue?.fileUri) return;

      vscode.postMessage({
        type: 'openIssue',
        fileUri: selectedRuleIssue.fileUri,
        line: selectedRuleIssue.line
      });
    });

    bindDialogDismiss(
      elements.qualityGateDialog,
      [
        elements.qualityGateDialogClose,
        elements.qualityGateDialogFooterClose
      ]
    );

    bindDialogDismiss(
      elements.hotspotDialog,
      [
        elements.hotspotDialogClose,
        elements.closeHotspotDialog
      ]
    );
    elements.openHotspotFile.addEventListener('click', () => {
      if (!selectedHotspot) return;

      vscode.postMessage({
        type: 'openIssue',
        fileUri: selectedHotspot.fileUri,
        line: selectedHotspot.line
      });
    });

    bindDialogDismiss(
      elements.issueDialog,
      [
        elements.issueDialogClose,
        elements.closeIssueDialog
      ]
    );
    elements.issueAssign.addEventListener('click', () => {
      if (!selectedManagedIssue) return;

      vscode.postMessage({
        type: 'mutateIssue',
        mutationKind: 'assign',
        issueKey: selectedManagedIssue.key,
        folderUri: selectedManagedIssue.folderUri,
        assignee: elements.issueAssignee.value
      });
    });
    elements.issueAddComment.addEventListener('click', () => {
      const comment = elements.issueComment.value.trim();
      if (!selectedManagedIssue || !comment) return;

      vscode.postMessage({
        type: 'mutateIssue',
        mutationKind: 'comment',
        issueKey: selectedManagedIssue.key,
        folderUri: selectedManagedIssue.folderUri,
        comment
      });
    });
    elements.issueFlowSelect.addEventListener('change', () => {
      selectedFlowIndex =
        Number(elements.issueFlowSelect.value) ||
        0;
      selectedFlowLocationIndex = 0;

      if (selectedManagedIssue) {
        renderIssueFlows(selectedManagedIssue);
      }
    });

    const moveFlow = direction => {
      if (!selectedManagedIssue) return;

      const flows = availableIssueFlows(selectedManagedIssue);
      const locations =
        flows[selectedFlowIndex]?.locations ||
        [];
      if (!locations.length) return;

      selectedFlowLocationIndex =
        (
          selectedFlowLocationIndex +
          direction +
          locations.length
        ) %
        locations.length;

      renderIssueFlows(selectedManagedIssue);
      vscode.postMessage({
        type: 'selectFlowLocation',
        issueKey: selectedManagedIssue.key,
        flowIndex: selectedFlowIndex,
        locationIndex: selectedFlowLocationIndex
      });
    };

    elements.issueFlowPrevious.addEventListener(
      'click',
      () => moveFlow(-1)
    );
    elements.issueFlowNext.addEventListener(
      'click',
      () => moveFlow(1)
    );
    elements.openManagedIssueFile.addEventListener('click', () => {
      if (!selectedManagedIssue) return;

      vscode.postMessage({
        type: 'openIssue',
        fileUri: selectedManagedIssue.fileUri,
        line: selectedManagedIssue.line
      });
    });

    bindDialogDismiss(
      elements.coverageDialog,
      [
        elements.coverageDialogClose,
        elements.closeCoverageDialog
      ]
    );
    elements.openCoverageFile.addEventListener('click', () => {
      if (!selectedCoverageFile) return;

      vscode.postMessage({
        type: 'openIssue',
        fileUri: selectedCoverageFile.fileUri,
        line: 1
      });
    });

    bindDialogDismiss(
      elements.analysisConfirmationDialog,
      [
        elements.analysisConfirmationClose,
        elements.analysisConfirmationCancel
      ]
    );
    elements.analysisConfirmationBack.addEventListener(
      'click',
      () => showAnalysisConfirmationStep(1)
    );
    elements.analysisConfirmationNext.addEventListener(
      'click',
      reviewRepositoryAnalysis
    );
    elements.analysisConfirmationConfirm.addEventListener(
      'click',
      confirmRepositoryAnalysis
    );
    elements.analysisAddStep.addEventListener(
      'click',
      event => addSelectedAnalysisStep(event)
    );
    elements.analysisPipelineTemplate.addEventListener('change', () => {
      applyTemplateToAnalysis(
        pipelineTemplateById(elements.analysisPipelineTemplate.value)
      );
      refreshAnalysisConfirmationSummary();
    });

    bindDialogDismiss(
      elements.createComponentDialog,
      [
        elements.createComponentClose,
        elements.createComponentCancel
      ]
    );

    bindDialogDismiss(
      elements.analysisDialog,
      [
        elements.analysisDialogClose,
        elements.analysisDialogFooterClose
      ]
    );
    elements.analysisDialogCancel.addEventListener(
      'click',
      cancelRepositoryAnalysis
    );
`;
