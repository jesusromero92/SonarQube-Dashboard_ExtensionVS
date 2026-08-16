import * as vscode from 'vscode';
import {
  buildMarketplaceRatingUrl,
  buildSupportIssuePageUrl,
  buildSupportIssueReport,
  RatingPromptState,
  sanitizeSupportText,
  shouldPromptForRating
} from './userFeedbackPolicy';

const FEEDBACK_STATE_KEY = 'sonarQubeDashboard.userFeedback.v1';

interface StoredFeedbackState extends RatingPromptState {
  readonly successCount: number;
}

export interface SupportContext {
  readonly source?: string;
  readonly errorMessage?: string;
}

export class UserFeedbackService implements vscode.Disposable {
  private ratingPromptInFlight = false;
  private disposed = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly getLanguage: () => 'es' | 'en'
  ) {}

  dispose(): void {
    this.disposed = true;
  }

  recordError(): void {
    if (this.disposed) return;
    void this.updateState(state => ({
      ...state,
      lastErrorAt: Date.now()
    }));
  }

  recordSuccessfulUse(): void {
    if (this.disposed) return;
    void this.recordSuccessfulUseAsync();
  }

  async showErrorWithSupport(
    message: string,
    supportContext: SupportContext = {}
  ): Promise<void> {
    this.recordError();
    const supportLabel = this.text('Contactar soporte', 'Contact support');
    const selected = await vscode.window.showErrorMessage(message, supportLabel);
    if (selected === supportLabel) {
      await this.contactSupport({
        ...supportContext,
        errorMessage: supportContext.errorMessage ?? message
      });
    }
  }

  async contactSupport(supportContext: SupportContext = {}): Promise<void> {
    if (this.disposed) return;
    const packageJson = this.context.extension.packageJSON as {
      version?: unknown;
      bugs?: { url?: unknown } | string;
      repository?: { url?: unknown } | string;
    };
    const issuesUrl = this.resolveIssuesUrl(packageJson);
    if (!issuesUrl) {
      await vscode.window.showWarningMessage(
        this.text(
          'No se ha configurado una URL de soporte para la extensión.',
          'No support URL is configured for the extension.'
        )
      );
      return;
    }

    const report = buildSupportIssueReport({
      extensionVersion: String(packageJson.version ?? ''),
      vscodeVersion: vscode.version,
      platform: process.platform,
      architecture: process.arch,
      remoteName: vscode.env.remoteName,
      source: supportContext.source,
      errorMessage: supportContext.errorMessage
    });
    await vscode.env.clipboard.writeText(report);

    const supportPageUrl = buildSupportIssuePageUrl(issuesUrl);
    await vscode.env.openExternal(vscode.Uri.parse(supportPageUrl));
    await vscode.window.showInformationMessage(
      this.text(
        'El informe de soporte se ha copiado al portapapeles. Pégalo en «Redacted diagnostics report and logs» del formulario Bug report con Ctrl+V.',
        'The support report was copied to the clipboard. Paste it into “Redacted diagnostics report and logs” in the Bug report form with Ctrl+V.'
      )
    );
  }

  async rateExtension(): Promise<void> {
    if (this.disposed) return;
    const packageJson = this.context.extension.packageJSON as {
      name?: unknown;
      publisher?: unknown;
    };
    const publisher = String(packageJson.publisher ?? '').trim();
    const extensionName = String(packageJson.name ?? '').trim();
    if (!publisher || !extensionName) {
      await vscode.window.showWarningMessage(
        this.text(
          'No se pudo determinar la ficha de Marketplace de la extensión.',
          'The extension Marketplace listing could not be determined.'
        )
      );
      return;
    }

    const url = buildMarketplaceRatingUrl(publisher, extensionName);
    await this.updateState(state => ({
      ...state,
      ratingOpened: true,
      lastRatingPromptAt: Date.now()
    }));
    await vscode.env.openExternal(vscode.Uri.parse(url));
  }

  private async recordSuccessfulUseAsync(): Promise<void> {
    const now = Date.now();
    const state = await this.updateState(current => ({
      ...current,
      firstSuccessAt: current.firstSuccessAt ?? now,
      successCount: current.successCount + 1
    }));

    if (
      this.ratingPromptInFlight ||
      this.disposed ||
      !shouldPromptForRating(state, now)
    ) {
      return;
    }

    this.ratingPromptInFlight = true;
    try {
      await this.promptForRating(now);
    } finally {
      this.ratingPromptInFlight = false;
    }
  }

  private async promptForRating(now: number): Promise<void> {
    await this.updateState(state => ({
      ...state,
      lastRatingPromptAt: now
    }));

    const rateLabel = this.text('Puntuar extensión', 'Rate extension');
    const laterLabel = this.text('Más tarde', 'Later');
    const dismissLabel = this.text('No volver a preguntar', "Don't ask again");
    const selected = await vscode.window.showInformationMessage(
      this.text(
        '¿Te está resultando útil SonarQube Dashboard & Pipeline? Tu valoración ayuda a mejorar y dar visibilidad a la extensión.',
        'Is SonarQube Dashboard & Pipeline useful to you? Your rating helps improve the extension and makes it easier to discover.'
      ),
      rateLabel,
      laterLabel,
      dismissLabel
    );

    if (selected === rateLabel) {
      await this.rateExtension();
      return;
    }
    if (selected === dismissLabel) {
      await this.updateState(state => ({
        ...state,
        ratingDismissed: true
      }));
    }
  }

  private currentState(): StoredFeedbackState {
    const saved = this.context.globalState.get<StoredFeedbackState>(
      FEEDBACK_STATE_KEY
    );
    return {
      ...saved,
      successCount: Math.max(0, Number(saved?.successCount ?? 0) || 0)
    };
  }

  private async updateState(
    update: (state: StoredFeedbackState) => StoredFeedbackState
  ): Promise<StoredFeedbackState> {
    const next = update(this.currentState());
    await this.context.globalState.update(FEEDBACK_STATE_KEY, next);
    return next;
  }

  private resolveIssuesUrl(packageJson: {
    bugs?: { url?: unknown } | string;
    repository?: { url?: unknown } | string;
  }): string {
    const bugsUrl = typeof packageJson.bugs === 'string'
      ? packageJson.bugs
      : String(packageJson.bugs?.url ?? '');
    if (bugsUrl.trim()) {
      return bugsUrl.trim();
    }

    const repositoryUrl = typeof packageJson.repository === 'string'
      ? packageJson.repository
      : String(packageJson.repository?.url ?? '');
    if (!repositoryUrl.trim()) {
      return '';
    }

    const normalized = repositoryUrl
      .replace(/^git\+/u, '')
      .replace(/\.git$/u, '')
      .replace(/^git@github\.com:/u, 'https://github.com/');
    return `${normalized.replace(/\/+$/u, '')}/issues`;
  }

  private text(spanish: string, english: string): string {
    return this.getLanguage() === 'es' ? spanish : english;
  }
}


let feedbackService: UserFeedbackService | undefined;

export function initializeUserFeedback(
  context: vscode.ExtensionContext,
  getLanguage: () => 'es' | 'en'
): UserFeedbackService {
  feedbackService?.dispose();
  feedbackService = new UserFeedbackService(context, getLanguage);
  return feedbackService;
}

export async function showErrorWithSupport(
  message: string,
  source?: string
): Promise<void> {
  if (!feedbackService) {
    await vscode.window.showErrorMessage(message);
    return;
  }
  await feedbackService.showErrorWithSupport(message, {
    source,
    errorMessage: sanitizeSupportText(message)
  });
}

export async function contactSupport(
  supportContext: SupportContext = {}
): Promise<void> {
  await feedbackService?.contactSupport(supportContext);
}

export async function rateExtension(): Promise<void> {
  await feedbackService?.rateExtension();
}

export function recordUserFacingError(): void {
  feedbackService?.recordError();
}

export function recordSuccessfulUse(): void {
  feedbackService?.recordSuccessfulUse();
}
