export const ISSUE_ACTIVITY_SCRIPT = `
    function renderLifecycleActivity(container, items, emptyText, renderer) {
      container.textContent = '';

      if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = emptyText;
        container.appendChild(empty);
        return;
      }

      for (const item of items) {
        container.appendChild(renderer(item));
      }
    }

    function createActivityCard(author, dateValue) {
      const card = document.createElement('article');
      card.className = 'activity-item';

      const heading = document.createElement('strong');
      heading.textContent = author || 'SonarQube';

      const date = document.createElement('time');
      date.textContent = formatLifecycleDate(dateValue);

      card.append(heading, date);
      return card;
    }

    function renderIssueActivity(detail) {
      const comments = detail.comments || [];
      const history = detail.history || [];

      elements.issueCommentsCount.textContent = String(comments.length);
      elements.issueHistoryCount.textContent = String(history.length);

      renderLifecycleActivity(
        elements.issueComments,
        comments,
        'No hay comentarios.',
        comment => {
          const card = createActivityCard(comment.user, comment.createdAt);
          const text = document.createElement('p');
          text.textContent = comment.text;
          card.appendChild(text);
          return card;
        }
      );

      renderLifecycleActivity(
        elements.issueHistory,
        history,
        'No hay historial disponible.',
        entry => {
          const card = createActivityCard(entry.user, entry.date);

          for (const change of entry.changes || []) {
            const text = document.createElement('p');
            text.textContent =
              change.field +
              ': ' +
              (change.oldValue || '—') +
              ' → ' +
              (change.newValue || '—');
            card.appendChild(text);
          }

          return card;
        }
      );
    }
`;
