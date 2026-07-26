export const COMMENT_COMPOSER_STYLES = `
    .comment-composer {
      display: grid;
      gap: 8px;
      padding-bottom: 12px;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .comment-composer[hidden] {
      display: none;
    }
    .comment-composer textarea {
      min-height: 76px;
    }
    .comment-composer__actions {
      display: flex;
      justify-content: flex-end;
    }
    .comment-composer__actions button {
      width: 130px;
      min-width: 130px;
    }
    @media (max-width: 640px) {
      .comment-composer__actions button {
        width: 100%;
      }
    }
`;
