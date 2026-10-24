export interface TirPlanApiPrice {
  committed_days?: number;
  currency?: string;
  sku_item_price_id: number;
  sku_type: string;
  unit_price?: number;
}

export interface TirPlanApiItem {
  cpu?: string | null;
  gpu?: string | null;
  gpu_card_type?: string | null;
  gpu_memory?: string | null;
  is_inventory_available?: boolean;
  memory?: string | null;
  name: string;
  plans?: TirPlanApiPrice[];
  series?: string;
}

// The plan list arrives grouped by series (CPU, GPU, SPOT_INSTANCE, ...),
// next to a few yes/no flags that are not plan groups.
export type TirPlanApiGroups = Record<string, TirPlanApiItem[] | boolean>;

export interface TirPlanPrice {
  plan_id: number;
  price: number | null;
}

export interface TirPlanCommittedPrice extends TirPlanPrice {
  days: number | null;
}

export interface TirPlanItem {
  available: boolean;
  committed: TirPlanCommittedPrice[];
  currency: string | null;
  gpu: { count: number | null; memory: string | null; type: string } | null;
  hourly: TirPlanPrice | null;
  memory: string | null;
  name: string;
  series: string;
  vcpu: number | null;
}

export interface TirPlanContextOptions {
  accountId?: string;
  alias?: string;
  imageVersionId?: string;
  location?: string;
  projectId?: string;
}

export interface TirPlanListCommandResult {
  action: 'list';
  image_version_id: number | null;
  items: TirPlanItem[];
}

export type TirPlanCommandResult = TirPlanListCommandResult;
