export const RULE_DIALOG_SCRIPT = `    function showRuleDialog(issue) {
      elements.ruleDialogTitle.textContent = issue.ruleName || issue.rule;
      elements.ruleDialogDescription.textContent = issue.message;
      elements.ruleDialog.showModal();
    }

`;
