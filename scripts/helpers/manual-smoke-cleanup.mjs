export function classifyCleanupMessage(message) {
  return isAlreadyGoneMessage(message) ? 'already-gone' : 'retryable';
}

export function classifyCleanupError(error) {
  return classifyCleanupMessage(formatError(error));
}

export function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function isAlreadyGoneMessage(message) {
  return /\bnot found\b/i.test(message) || /\balready gone\b/i.test(message);
}

export function isMissingFileError(error) {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code === 'ENOENT'
  );
}

export function toDnsDeleteContent(recordType, value) {
  return recordType === 'TXT' ? stripEnclosingDoubleQuotes(value) : value;
}

function stripEnclosingDoubleQuotes(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  return value;
}
