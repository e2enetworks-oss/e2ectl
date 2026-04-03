export interface SecurityGroupRuleInput {
  description?: string;
  network?: string;
  network_cidr?: string;
  network_size?: number;
  port_range?: string;
  protocol_name?: string;
  rule_type?: string;
  vpc_id?: number | null;
  [key: string]: unknown;
}

export interface SecurityGroupRuleSummary {
  description?: string | null;
  id?: number;
  network?: string | null;
  network_cidr?: string | null;
  network_size?: number | null;
  port_range?: string | null;
  protocol_name?: string | null;
  rule_type?: string | null;
  vpc_id?: number | null;
}

export interface SecurityGroupSummary {
  description?: string | null;
  id: number;
  is_all_traffic_rule?: boolean;
  is_default: boolean;
  name: string;
  rules: SecurityGroupRuleSummary[];
}

export interface SecurityGroupCreateRequest {
  default?: boolean;
  description?: string;
  name: string;
  rules: SecurityGroupRuleInput[];
}

export interface SecurityGroupCreateResult {
  label_id?: string | null;
  resource_type?: string | null;
}

export interface SecurityGroupDeleteResult {
  name?: string | null;
}

export interface SecurityGroupUpdateRequest {
  description?: string;
  name: string;
  rules: SecurityGroupRuleInput[];
}

export interface SecurityGroupNodeActionRequest {
  security_group_ids: number[];
}

export interface SecurityGroupNodeActionResult {
  message: string;
}
