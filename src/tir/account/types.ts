// One account the key can work in: the person's own account or one they
// were invited to (TIR calls these IAM memberships).
export interface TirAccountApiItem {
  has_tir_access?: boolean;
  id: number;
  owner?: {
    email?: string;
    name?: string;
  };
  role?: string;
}

export interface TirAccountItem {
  email: string;
  id: number;
  name: string;
  role: string;
  tir_access: boolean;
}

export interface TirAccountContextOptions {
  alias?: string;
}

export interface TirAccountListCommandResult {
  action: 'list';
  items: TirAccountItem[];
}

export type TirAccountCommandResult = TirAccountListCommandResult;
