import type {
  LoadBalancerAlgorithm,
  LoadBalancerCommittedStatus,
  LoadBalancerMode
} from './types/index.js';

export const LOAD_BALANCER_DEFAULT_TIMEOUT = 60;
export const LOAD_BALANCER_DEFAULT_POST_COMMIT_BEHAVIOR: LoadBalancerCommittedStatus =
  'auto_renew';

export const LOAD_BALANCER_FRONTEND_PROTOCOLS: LoadBalancerMode[] = [
  'HTTP',
  'HTTPS',
  'BOTH',
  'TCP'
];

export const LOAD_BALANCER_ALB_MODES: LoadBalancerMode[] = [
  'HTTP',
  'HTTPS',
  'BOTH'
];

export const LOAD_BALANCER_SSL_MODES: LoadBalancerMode[] = ['HTTPS', 'BOTH'];

export const LOAD_BALANCER_ALGORITHMS: LoadBalancerAlgorithm[] = [
  'roundrobin',
  'leastconn',
  'source'
];

export const LOAD_BALANCER_COMMAND_ALGORITHMS: LoadBalancerAlgorithm[] =
  LOAD_BALANCER_ALGORITHMS;

export const LOAD_BALANCER_ALB_BACKEND_PROTOCOLS = ['HTTP', 'HTTPS'] as const;

export const LOAD_BALANCER_TYPES = ['external', 'internal'] as const;

export const LOAD_BALANCER_BILLING_TYPES = ['hourly', 'committed'] as const;
export const LOAD_BALANCER_POST_COMMIT_BEHAVIORS = [
  'auto-renew',
  'hourly-billing'
] as const;
