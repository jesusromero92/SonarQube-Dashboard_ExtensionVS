export interface ScopeUnavailableNoticeOptions {
  id: string;
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function getNewCodeEvolutionUnavailableMarkup({
  id
}: ScopeUnavailableNoticeOptions): string {
  return `              <div
                id="${escapeAttribute(id)}"
                class="scope-unavailable-notice"
                role="status"
                hidden
              >
                <strong>No hay evolución histórica para código nuevo</strong>
                <span>El periodo de código nuevo puede cambiar entre análisis, por lo que su histórico no es directamente comparable. Cambia a Overall para consultar la evolución.</span>
              </div>`;
}
