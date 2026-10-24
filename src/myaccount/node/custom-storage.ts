export const CUSTOM_STORAGE_MIN_DISK_GB = 75;
export const CUSTOM_STORAGE_DEFAULT_DISK_GB = 150;
export const CUSTOM_STORAGE_MAX_DISK_GB = 2400;
export const CUSTOM_STORAGE_DOWNSIZE_STEP_GB = 25;
export const CUSTOM_STORAGE_UPSIZE_STEP_GB = 50;

const CUSTOM_STORAGE_SERIES = new Set(['E1', 'E1WC']);

export function formatCustomStorageDiskHint(): string {
  return (
    `Allowed sizes: ${CUSTOM_STORAGE_MIN_DISK_GB}-${CUSTOM_STORAGE_MAX_DISK_GB} GB; ` +
    `${CUSTOM_STORAGE_DOWNSIZE_STEP_GB} GB steps below ${CUSTOM_STORAGE_DEFAULT_DISK_GB} GB; ` +
    `${CUSTOM_STORAGE_UPSIZE_STEP_GB} GB steps at or above ${CUSTOM_STORAGE_DEFAULT_DISK_GB} GB.`
  );
}

export function isCustomStorageDiskSizeAllowed(value: number): boolean {
  if (!Number.isInteger(value)) {
    return false;
  }

  if (
    value < CUSTOM_STORAGE_MIN_DISK_GB ||
    value > CUSTOM_STORAGE_MAX_DISK_GB
  ) {
    return false;
  }

  if (value < CUSTOM_STORAGE_DEFAULT_DISK_GB) {
    return value % CUSTOM_STORAGE_DOWNSIZE_STEP_GB === 0;
  }

  return value % CUSTOM_STORAGE_UPSIZE_STEP_GB === 0;
}

export function isCustomStoragePlan(plan: string): boolean {
  return isCustomStorageSeries(extractPlanSeries(plan));
}

export function isCustomStorageSeries(
  series: string | null | undefined
): boolean {
  return (
    series !== null && series !== undefined && CUSTOM_STORAGE_SERIES.has(series)
  );
}

function extractPlanSeries(plan: string): string | null {
  const normalizedPlan = plan.trim();

  if (normalizedPlan.length === 0) {
    return null;
  }

  const separatorIndex = normalizedPlan.indexOf('-');
  return separatorIndex === -1
    ? normalizedPlan
    : normalizedPlan.slice(0, separatorIndex);
}
