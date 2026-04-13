export type CleanupClassification = 'already-gone' | 'retryable';
export type CleanupRunStatus = CleanupClassification | 'ok';

export interface SmokeCleanupContext {
  deleteSavedImage(imageId: string): Promise<void>;
  getFallbackClients(): Promise<Record<string, unknown>>;
  loadManifest(): Promise<Record<string, unknown>>;
  logError(message: string): void;
  logInfo(message: string): void;
  removeFile(filePath: string): Promise<void>;
  runCliCleanup(args: string[]): Promise<{
    status: CleanupRunStatus;
  }>;
  updateManifest(
    mutate: (manifest: Record<string, unknown>) => void
  ): Promise<Record<string, unknown>>;
}

export function runSmokeCleanup(context: SmokeCleanupContext): Promise<{
  hadFailures: boolean;
}>;

export function classifyCleanupMessage(message: string): CleanupClassification;

export function classifyCleanupError(error: unknown): CleanupClassification;

export function formatError(error: unknown): string;

export function isAlreadyGoneMessage(message: string): boolean;

export function isMissingFileError(error: unknown): boolean;
