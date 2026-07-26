export const ISSUE_STATE_SCRIPT = `
    let selectedManagedIssue = null;
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
      return labels[String(transition.key || '').toLowerCase()] ||
        transition.name ||
        transition.key;
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
        ? new Intl.DateTimeFormat(dashboardLocale, {
            dateStyle: 'medium',
            timeStyle: 'short'
          }).format(date)
        : String(value);
    }

    function appendDetailTerm(list, term, value) {
      const dt = document.createElement('dt');
      dt.textContent = term;
      const dd = document.createElement('dd');
      dd.textContent = value || 'No disponible';
      list.append(dt, dd);
    }
`;
