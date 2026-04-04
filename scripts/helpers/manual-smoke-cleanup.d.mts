export type CleanupClassification = 'already-gone' | 'retryable';

export function classifyCleanupMessage(message: string): CleanupClassification;

export function classifyCleanupError(error: unknown): CleanupClassification;

export function formatError(error: unknown): string;

export function isAlreadyGoneMessage(message: string): boolean;

export function isMissingFileError(error: unknown): boolean;

export function toDnsDeleteContent(recordType: string, value: string): string;
