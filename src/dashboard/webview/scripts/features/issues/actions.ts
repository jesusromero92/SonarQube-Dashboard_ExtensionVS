export const ISSUE_ACTIONS_SCRIPT = `
    function renderAssignableUsers(users, selectedLogin) {
      elements.issueAssignee.textContent = '';

      const unassigned = document.createElement('option');
      unassigned.value = '';
      unassigned.textContent = 'Sin asignar';
      elements.issueAssignee.appendChild(unassigned);

      for (const user of users) {
        const option = document.createElement('option');
        option.value = user.login;
        option.textContent =
          (user.name || user.login) +
          (user.name ? ' · ' + user.login : '');
        elements.issueAssignee.appendChild(option);
      }

      elements.issueAssignee.value = selectedLogin;
    }

    function createTransitionButton(issue, transition, currentTransition) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary';
      button.textContent = transitionLabel(transition);
      button.disabled =
        String(transition.key || '').toLowerCase() === currentTransition;

      if (button.disabled) {
        button.title = 'Estado actual';
        button.setAttribute('aria-current', 'true');
      } else {
        button.addEventListener('click', () => {
          vscode.postMessage({
            type: 'mutateIssue',
            mutationKind: 'transition',
            issueKey: issue.key,
            folderUri: issue.folderUri,
            transition: transition.key
          });
        });
      }

      return button;
    }

    function renderIssueTransitions(detail, issue) {
      elements.issueTransitionActions.textContent = '';

      const transitions = detail.transitions || [];
      const currentTransition = currentTransitionForStatus(issueStatus(issue));
      let currentTransitionRendered = false;

      for (const transition of transitions) {
        const button = createTransitionButton(
          issue,
          transition,
          currentTransition
        );
        if (button.disabled) {
          currentTransitionRendered = true;
        }
        elements.issueTransitionActions.appendChild(button);
      }

      if (currentTransition && !currentTransitionRendered) {
        const currentButton = createTransitionButton(
          issue,
          { key: currentTransition },
          currentTransition
        );
        elements.issueTransitionActions.prepend(currentButton);
      }

      if (!transitions.length) {
        const noTransitions = document.createElement('span');
        noTransitions.className = 'muted';
        noTransitions.textContent =
          'El token no dispone de transiciones de estado para este defecto.';
        elements.issueTransitionActions.appendChild(noTransitions);
      }
    }

    function renderIssueActions(detail, issue) {
      const transitions = detail.transitions || [];
      elements.issueActionsSection.hidden = !(
        transitions.length ||
        detail.canAssign ||
        detail.canComment
      );

      renderIssueTransitions(detail, issue);

      elements.issueAssignment.hidden = !detail.canAssign;
      renderAssignableUsers(detail.users || [], issue.assignee || '');

      elements.issueCommentForm.hidden = !detail.canComment;
      elements.issueComment.value = '';
    }
`;
