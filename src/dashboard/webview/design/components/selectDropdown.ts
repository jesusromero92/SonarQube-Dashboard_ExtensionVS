export const SELECT_DROPDOWN_STYLES = `
    .select-dropdown {
      position: relative;
      width: 128px;
      min-width: 0;
    }
    .select-dropdown--fluid {
      width: 100%;
    }
    .select-dropdown__native {
      position: absolute;
      width: 1px;
      height: 1px;
      min-height: 0;
      margin: 0;
      padding: 0;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
    }
    .select-dropdown__trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-height: 32px;
      gap: 10px;
      padding: 5px 9px;
      border: 1px solid var(--vscode-dropdown-border, var(--vscode-input-border, transparent));
      border-radius: 0;
      color: var(--vscode-dropdown-foreground, var(--vscode-input-foreground));
      background: var(--vscode-dropdown-background, var(--vscode-input-background));
      text-align: left;
      white-space: nowrap;
    }
    .select-dropdown__trigger:hover:not(:disabled) {
      background: var(--vscode-dropdown-background, var(--vscode-input-background));
    }
    .select-dropdown__trigger:disabled {
      cursor: default;
      opacity: .55;
    }
    .select-dropdown__value {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .select-dropdown__chevron {
      width: 7px;
      height: 7px;
      flex: 0 0 auto;
      border-right: 1.5px solid currentColor;
      border-bottom: 1.5px solid currentColor;
      transform: translateY(-2px) rotate(45deg);
      transition: transform 120ms ease;
    }
    .select-dropdown[data-open="true"] {
      z-index: 100;
    }
    .select-dropdown[data-open="true"] .select-dropdown__chevron {
      transform: translateY(2px) rotate(225deg);
    }
    .select-dropdown__menu {
      position: absolute;
      top: calc(100% + 7px);
      right: 0;
      left: 0;
      box-sizing: border-box;
      width: 100%;
      min-width: 100%;
      max-height: 220px;
      padding: 3px;
      overflow-x: hidden;
      overflow-y: auto;
      border: 1px solid var(--vscode-dropdown-border, var(--vscode-panel-border));
      color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
      background: var(--vscode-dropdown-background, var(--vscode-editorWidget-background));
      box-shadow: 0 6px 18px rgba(0, 0, 0, .35);
    }
    .select-dropdown__option {
      display: block;
      width: 100%;
      min-height: 28px;
      padding: 5px 8px;
      border: 0;
      border-radius: 0;
      color: inherit;
      background: transparent;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .select-dropdown__option:hover:not(:disabled),
    .select-dropdown__option:focus-visible:not(:disabled) {
      color: var(--vscode-list-hoverForeground, var(--vscode-foreground));
      background: var(--vscode-list-hoverBackground);
      outline: none;
    }
    .select-dropdown__option[aria-selected="true"] {
      color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground));
      background: var(--vscode-list-activeSelectionBackground);
    }
    .select-dropdown__option:disabled {
      cursor: default;
      opacity: .55;
    }
`;
