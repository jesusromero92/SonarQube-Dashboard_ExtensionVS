export const TERMINAL_SCRIPT = `    const TERMINAL_ESC = String.fromCharCode(27);
    const TERMINAL_BEL = String.fromCharCode(7);

    function terminalStreamFromEntries(entries) {
      const values = Array.isArray(entries)
        ? entries.map(value => String(value ?? ''))
        : [];
      if (values.length === 0) return '';

      // Historial anterior a 1.2.0 guardaba una entrada por línea. El formato
      // nuevo conserva los chunks reales del proceso para poder interpretar
      // retornos de carro, ANSI y actualizaciones de progreso de cualquier CLI.
      const isTerminalStream = values.some(value =>
        value.includes('\\n') || value.includes('\\r') || value.includes(TERMINAL_ESC)
      );
      return isTerminalStream ? values.join('') : values.join('\\n');
    }

    function terminalDefaultStyle() {
      return {
        foreground: '',
        background: '',
        bold: false,
        dim: false,
        italic: false,
        underline: false,
        inverse: false,
        hidden: false,
        strike: false
      };
    }

    function terminalCloneStyle(style) {
      return { ...style };
    }

    function terminalAnsiColor(index) {
      const variables = [
        '--vscode-terminal-ansiBlack',
        '--vscode-terminal-ansiRed',
        '--vscode-terminal-ansiGreen',
        '--vscode-terminal-ansiYellow',
        '--vscode-terminal-ansiBlue',
        '--vscode-terminal-ansiMagenta',
        '--vscode-terminal-ansiCyan',
        '--vscode-terminal-ansiWhite',
        '--vscode-terminal-ansiBrightBlack',
        '--vscode-terminal-ansiBrightRed',
        '--vscode-terminal-ansiBrightGreen',
        '--vscode-terminal-ansiBrightYellow',
        '--vscode-terminal-ansiBrightBlue',
        '--vscode-terminal-ansiBrightMagenta',
        '--vscode-terminal-ansiBrightCyan',
        '--vscode-terminal-ansiBrightWhite'
      ];
      if (index >= 0 && index < variables.length) {
        return 'var(' + variables[index] + ')';
      }
      if (index >= 16 && index <= 231) {
        const value = index - 16;
        const red = Math.floor(value / 36);
        const green = Math.floor((value % 36) / 6);
        const blue = value % 6;
        const component = part => part === 0 ? 0 : 55 + part * 40;
        return 'rgb(' + component(red) + ', ' + component(green) + ', ' + component(blue) + ')';
      }
      if (index >= 232 && index <= 255) {
        const gray = 8 + (index - 232) * 10;
        return 'rgb(' + gray + ', ' + gray + ', ' + gray + ')';
      }
      return '';
    }

    function terminalRgbColor(red, green, blue) {
      const clamp = value => Math.max(0, Math.min(255, Number(value) || 0));
      return 'rgb(' + clamp(red) + ', ' + clamp(green) + ', ' + clamp(blue) + ')';
    }

    function terminalSgrNumbers(raw) {
      if (!raw) return [0];
      return raw
        .replace(/:/g, ';')
        .split(';')
        .filter((value, index, items) => value !== '' || items.length === 1 || index === 0)
        .map(value => value === '' ? 0 : Number(value))
        .filter(value => Number.isFinite(value));
    }

    function terminalApplySgr(style, raw) {
      const values = terminalSgrNumbers(raw);
      for (let index = 0; index < values.length; index += 1) {
        const code = values[index];
        if (code === 0) {
          Object.assign(style, terminalDefaultStyle());
        } else if (code === 1) {
          style.bold = true;
        } else if (code === 2) {
          style.dim = true;
        } else if (code === 3) {
          style.italic = true;
        } else if (code === 4 || code === 21) {
          style.underline = true;
        } else if (code === 7) {
          style.inverse = true;
        } else if (code === 8) {
          style.hidden = true;
        } else if (code === 9) {
          style.strike = true;
        } else if (code === 22) {
          style.bold = false;
          style.dim = false;
        } else if (code === 23) {
          style.italic = false;
        } else if (code === 24) {
          style.underline = false;
        } else if (code === 27) {
          style.inverse = false;
        } else if (code === 28) {
          style.hidden = false;
        } else if (code === 29) {
          style.strike = false;
        } else if (code >= 30 && code <= 37) {
          style.foreground = terminalAnsiColor(code - 30);
        } else if (code === 39) {
          style.foreground = '';
        } else if (code >= 40 && code <= 47) {
          style.background = terminalAnsiColor(code - 40);
        } else if (code === 49) {
          style.background = '';
        } else if (code >= 90 && code <= 97) {
          style.foreground = terminalAnsiColor(code - 90 + 8);
        } else if (code >= 100 && code <= 107) {
          style.background = terminalAnsiColor(code - 100 + 8);
        } else if (code === 38 || code === 48) {
          const target = code === 38 ? 'foreground' : 'background';
          const mode = values[index + 1];
          if (mode === 5 && Number.isFinite(values[index + 2])) {
            style[target] = terminalAnsiColor(values[index + 2]);
            index += 2;
          } else if (
            mode === 2 &&
            Number.isFinite(values[index + 2]) &&
            Number.isFinite(values[index + 3]) &&
            Number.isFinite(values[index + 4])
          ) {
            style[target] = terminalRgbColor(
              values[index + 2],
              values[index + 3],
              values[index + 4]
            );
            index += 4;
          }
        }
      }
    }

    function terminalIsCombining(codePoint) {
      return (
        (codePoint >= 0x0300 && codePoint <= 0x036f) ||
        (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
        (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
        (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
        (codePoint >= 0xfe20 && codePoint <= 0xfe2f)
      );
    }

    function terminalCellWidth(codePoint) {
      if (terminalIsCombining(codePoint)) return 0;
      return (
        codePoint >= 0x1100 && (
          codePoint <= 0x115f ||
          codePoint === 0x2329 || codePoint === 0x232a ||
          (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
          (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
          (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
          (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
          (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
          (codePoint >= 0xff00 && codePoint <= 0xff60) ||
          (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
          (codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
          (codePoint >= 0x20000 && codePoint <= 0x3fffd)
        )
      ) ? 2 : 1;
    }

    function terminalStyleKey(style) {
      return [
        style.foreground,
        style.background,
        style.bold ? 1 : 0,
        style.dim ? 1 : 0,
        style.italic ? 1 : 0,
        style.underline ? 1 : 0,
        style.inverse ? 1 : 0,
        style.hidden ? 1 : 0,
        style.strike ? 1 : 0
      ].join('|');
    }

    function parseTerminalStream(entries) {
      const stream = terminalStreamFromEntries(entries);
      const rows = [[]];
      let row = 0;
      let column = 0;
      let savedRow = 0;
      let savedColumn = 0;
      let style = terminalDefaultStyle();

      const ensureRow = target => {
        while (rows.length <= target) rows.push([]);
        return rows[target];
      };
      const currentRow = () => ensureRow(row);
      const cursorParam = (params, index, fallback = 1) => {
        const value = Number(params[index]);
        return Number.isFinite(value) && value > 0 ? value : fallback;
      };
      const putCharacter = character => {
        const codePoint = character.codePointAt(0) || 0;
        const width = terminalCellWidth(codePoint);
        const cells = currentRow();
        if (width === 0) {
          for (let target = Math.min(column - 1, cells.length - 1); target >= 0; target -= 1) {
            if (cells[target] && !cells[target].continuation) {
              cells[target].text += character;
              break;
            }
          }
          return;
        }
        while (cells.length < column) {
          cells.push({ text: ' ', style: terminalDefaultStyle(), continuation: false });
        }
        cells[column] = {
          text: character,
          style: terminalCloneStyle(style),
          continuation: false
        };
        if (width === 2) {
          cells[column + 1] = {
            text: '',
            style: terminalCloneStyle(style),
            continuation: true
          };
        }
        column += width;
      };
      const eraseCells = (start, end) => {
        const cells = currentRow();
        const safeStart = Math.max(0, start);
        const safeEnd = Math.max(safeStart, end);
        for (let target = safeStart; target < safeEnd; target += 1) {
          cells[target] = { text: ' ', style: terminalCloneStyle(style), continuation: false };
        }
      };
      const handleCsi = (rawParameters, final) => {
        const cleaned = rawParameters.replace(/^[?>!]/, '');
        const params = cleaned.split(';');
        const first = cursorParam(params, 0, 1);

        if (final === 'm') {
          terminalApplySgr(style, cleaned);
          return;
        }
        if (final === 'A') row = Math.max(0, row - first);
        else if (final === 'B') row += first;
        else if (final === 'C') column += first;
        else if (final === 'D') column = Math.max(0, column - first);
        else if (final === 'E') { row += first; column = 0; }
        else if (final === 'F') { row = Math.max(0, row - first); column = 0; }
        else if (final === 'G' || final.charCodeAt(0) === 96) column = Math.max(0, first - 1);
        else if (final === 'd') row = Math.max(0, first - 1);
        else if (final === 'H' || final === 'f') {
          row = Math.max(0, cursorParam(params, 0, 1) - 1);
          column = Math.max(0, cursorParam(params, 1, 1) - 1);
        } else if (final === 'J') {
          const mode = Number(params[0] || 0);
          if (mode === 2 || mode === 3) {
            rows.splice(0, rows.length, []);
            row = 0;
            column = 0;
          } else if (mode === 0) {
            currentRow().splice(column);
            rows.splice(row + 1);
          } else if (mode === 1) {
            for (let target = 0; target < row; target += 1) rows[target] = [];
            eraseCells(0, column + 1);
          }
        } else if (final === 'K') {
          const mode = Number(params[0] || 0);
          if (mode === 0) currentRow().splice(column);
          else if (mode === 1) eraseCells(0, column + 1);
          else if (mode === 2) rows[row] = [];
        } else if (final === 'P') {
          currentRow().splice(column, first);
        } else if (final === '@') {
          const blanks = Array.from({ length: first }, () => ({
            text: ' ',
            style: terminalCloneStyle(style),
            continuation: false
          }));
          currentRow().splice(column, 0, ...blanks);
        } else if (final === 'X') {
          eraseCells(column, column + first);
        } else if (final === 's') {
          savedRow = row;
          savedColumn = column;
        } else if (final === 'u') {
          row = savedRow;
          column = savedColumn;
        }
        ensureRow(row);
      };

      for (let index = 0; index < stream.length;) {
        const code = stream.charCodeAt(index);
        if (code === 27) {
          const next = stream[index + 1];
          if (next === '[') {
            let end = index + 2;
            while (end < stream.length) {
              const finalCode = stream.charCodeAt(end);
              if (finalCode >= 0x40 && finalCode <= 0x7e) break;
              end += 1;
            }
            if (end >= stream.length) break;
            handleCsi(stream.slice(index + 2, end), stream[end]);
            index = end + 1;
            continue;
          }
          if (next === ']') {
            let end = index + 2;
            while (end < stream.length) {
              if (stream[end] === TERMINAL_BEL) {
                end += 1;
                break;
              }
              if (stream.charCodeAt(end) === 27 && stream[end + 1] === '\\\\') {
                end += 2;
                break;
              }
              end += 1;
            }
            index = end;
            continue;
          }
          if (next === 'P' || next === '^' || next === '_' || next === 'X') {
            let end = index + 2;
            while (end < stream.length) {
              if (stream.charCodeAt(end) === 27 && stream[end + 1] === '\\\\') {
                end += 2;
                break;
              }
              end += 1;
            }
            index = end;
            continue;
          }
          if (next === '7') {
            savedRow = row;
            savedColumn = column;
          } else if (next === '8') {
            row = savedRow;
            column = savedColumn;
          } else if (next === 'c') {
            rows.splice(0, rows.length, []);
            row = 0;
            column = 0;
            style = terminalDefaultStyle();
          }
          index += Math.min(2, stream.length - index);
          continue;
        }

        if (code === 13) {
          column = 0;
          index += 1;
          continue;
        }
        if (code === 10) {
          row += 1;
          column = 0;
          ensureRow(row);
          index += 1;
          continue;
        }
        if (code === 8) {
          column = Math.max(0, column - 1);
          index += 1;
          continue;
        }
        if (code === 9) {
          const nextTab = (Math.floor(column / 8) + 1) * 8;
          while (column < nextTab) putCharacter(' ');
          index += 1;
          continue;
        }
        if (code < 32 || code === 127) {
          index += 1;
          continue;
        }

        const codePoint = stream.codePointAt(index);
        const character = String.fromCodePoint(codePoint);
        putCharacter(character);
        index += character.length;
      }

      while (rows.length > 1 && rows[rows.length - 1].length === 0) rows.pop();
      return rows;
    }

    function terminalApplySpanStyle(span, style) {
      let foreground = style.foreground;
      let background = style.background;
      if (style.inverse) {
        const originalForeground = foreground || 'var(--vscode-terminal-foreground, var(--vscode-foreground))';
        foreground = background || 'var(--vscode-terminal-background, var(--vscode-editor-background))';
        background = originalForeground;
      }
      if (foreground) span.style.color = foreground;
      if (background) span.style.backgroundColor = background;
      if (style.bold) span.style.fontWeight = '700';
      if (style.dim) span.style.opacity = '.65';
      if (style.italic) span.style.fontStyle = 'italic';
      if (style.hidden) span.style.visibility = 'hidden';
      const decorations = [];
      if (style.underline) decorations.push('underline');
      if (style.strike) decorations.push('line-through');
      if (decorations.length) span.style.textDecoration = decorations.join(' ');
    }

    function terminalLineFragment(cells) {
      const fragment = document.createDocumentFragment();
      let activeKey = '';
      let activeStyle = null;
      let activeText = '';

      const flush = () => {
        if (!activeText) return;
        const span = document.createElement('span');
        span.textContent = activeText;
        terminalApplySpanStyle(span, activeStyle || terminalDefaultStyle());
        fragment.appendChild(span);
        activeText = '';
      };

      for (const cell of cells) {
        if (!cell || cell.continuation) continue;
        const key = terminalStyleKey(cell.style);
        if (activeText && key !== activeKey) flush();
        activeKey = key;
        activeStyle = cell.style;
        activeText += cell.text;
      }
      flush();
      return fragment;
    }

    function renderTerminalLog(container, entries, emptyMessage) {
      const rows = parseTerminalStream(entries);
      const hasContent = terminalStreamFromEntries(entries).length > 0;
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      const followOutput = distanceFromBottom <= 24;
      const previousScrollTop = container.scrollTop;
      const fragment = document.createDocumentFragment();

      if (!hasContent && emptyMessage) {
        const line = document.createElement('div');
        line.className = 'terminal-line terminal-line--placeholder';
        line.textContent = emptyMessage;
        fragment.appendChild(line);
      } else {
        for (const cells of rows) {
          const line = document.createElement('div');
          line.className = 'terminal-line';
          line.appendChild(terminalLineFragment(cells));
          fragment.appendChild(line);
        }
      }

      container.replaceChildren(fragment);
      requestAnimationFrame(() => {
        container.scrollTop = followOutput
          ? container.scrollHeight
          : Math.min(previousScrollTop, container.scrollHeight);
      });
      return hasContent ? rows.length : 0;
    }

`;
