import type { NodeCommittedCreateStatus, NodeCreateRequest } from './types.js';

export interface BuildNodeCreateRequestInput extends Pick<
  NodeCreateRequest,
  'image' | 'name' | 'plan'
> {
  cn_id?: number;
  cn_status?: NodeCommittedCreateStatus;
}

// Keep the create payload aligned with the public-node serializer:
// send only the explicit CLI choices here and let the backend apply
// defaults for SG, VPC, reserve IP, encryption, and volume fields.
export const DEFAULT_NODE_CREATE_REQUEST = {
  backups: false,
  default_public_ip: false,
  disable_password: true,
  enable_bitninja: false,
  is_ipv6_availed: false,
  is_saved_image: false,
  label: 'default',
  number_of_instances: 1,
  ssh_keys: [],
  start_scripts: []
} as const satisfies Omit<
  NodeCreateRequest,
  'cn_id' | 'cn_status' | 'image' | 'name' | 'plan'
>;

export function buildDefaultNodeCreateRequest(
  input: BuildNodeCreateRequestInput
): NodeCreateRequest {
  return {
    ...DEFAULT_NODE_CREATE_REQUEST,
    ...input
  };
}
