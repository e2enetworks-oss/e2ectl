import { renderLoadBalancerResult } from '../../../src/load-balancer/formatter.js';
import { stableStringify } from '../../../src/core/json.js';
import type { LoadBalancerCommandResult } from '../../../src/load-balancer/service.js';

describe('renderLoadBalancerResult', () => {
  describe('list', () => {
    it('renders "No load balancers found." when list is empty', () => {
      const result: LoadBalancerCommandResult = { action: 'list', items: [] };
      expect(renderLoadBalancerResult(result, false)).toBe(
        'No load balancers found.\n'
      );
    });

    it('renders a table when items exist', () => {
      const result: LoadBalancerCommandResult = {
        action: 'list',
        items: [
          {
            id: 1,
            appliance_name: 'my-alb',
            status: 'RUNNING',
            lb_mode: 'HTTP',
            lb_type: 'external',
            public_ip: '1.2.3.4',
            private_ip: '10.0.0.1'
          }
        ]
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('my-alb');
      expect(output).toContain('RUNNING');
      expect(output).toContain('HTTP');
      expect(output).toContain('1.2.3.4');
      expect(output).toContain('10.0.0.1');
    });

    it('renders deterministic JSON output', () => {
      const result: LoadBalancerCommandResult = {
        action: 'list',
        items: [
          {
            id: 2,
            appliance_name: 'my-nlb',
            status: 'RUNNING',
            lb_mode: 'TCP',
            lb_type: 'external',
            public_ip: null,
            private_ip: '10.0.0.2'
          }
        ]
      };
      const output = renderLoadBalancerResult(result, true);
      expect(output).toBe(
        stableStringify({
          action: 'list',
          items: [
            {
              appliance_name: 'my-nlb',
              id: 2,
              lb_mode: 'TCP',
              lb_type: 'external',
              private_ip: '10.0.0.2',
              public_ip: null,
              status: 'RUNNING'
            }
          ]
        }) + '\n'
      );
    });
  });

  describe('create', () => {
    it('renders requested and created summaries (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'create',
        backend: {
          backend_port: null,
          health_check: false,
          name: 'web',
          protocol: 'HTTP',
          routing_policy: 'roundrobin',
          servers: [
            {
              backend_name: 'server-1',
              backend_ip: '10.0.0.1',
              backend_port: 8080
            }
          ]
        },
        billing: {
          committed_plan_id: null,
          committed_plan_name: null,
          post_commit_behavior: null,
          type: 'hourly'
        },
        requested: {
          frontend_port: 80,
          mode: 'HTTP',
          name: 'my-alb',
          plan_name: 'LB-2',
          type: 'external'
        },
        result: {
          appliance_id: 99,
          id: 'lb-99',
          resource_type: 'load_balancer',
          label_id: 'lbl-1'
        }
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Load balancer created.');
      expect(output).toContain('my-alb');
      expect(output).toContain('lb-99');
      expect(output).toContain('web');
      expect(output).toContain('server-1 (10.0.0.1:8080)');
    });

    it('renders JSON for create', () => {
      const result: LoadBalancerCommandResult = {
        action: 'create',
        backend: {
          backend_port: null,
          health_check: true,
          name: 'web',
          protocol: 'HTTPS',
          routing_policy: 'leastconn',
          servers: []
        },
        billing: {
          committed_plan_id: 901,
          committed_plan_name: '90 Days',
          post_commit_behavior: 'auto_renew',
          type: 'committed'
        },
        requested: {
          frontend_port: 443,
          mode: 'HTTPS',
          name: 'my-alb',
          plan_name: 'LB-2',
          type: 'external'
        },
        result: {
          appliance_id: 99,
          id: 'lb-99',
          resource_type: 'load_balancer',
          label_id: 'lbl-1'
        }
      };
      const output = renderLoadBalancerResult(result, true);
      const parsed = JSON.parse(output) as {
        action: string;
        backend: { protocol: string };
        billing: { type: string };
        requested: { name: string };
      };
      expect(parsed.action).toBe('create');
      expect(parsed.backend.protocol).toBe('HTTPS');
      expect(parsed.billing.type).toBe('committed');
      expect(parsed.requested.name).toBe('my-alb');
    });
  });

  describe('plans', () => {
    it('renders base plans and committed options in tables', () => {
      const result: LoadBalancerCommandResult = {
        action: 'plans',
        items: [
          {
            committed_sku: [
              {
                committed_days: 90,
                committed_sku_id: 901,
                committed_sku_name: '90 Days',
                committed_sku_price: 5000
              }
            ],
            disk: 50,
            hourly: 3,
            name: 'LB-2',
            price: 2000,
            ram: 4,
            template_id: 'plan-1',
            vcpu: 2
          }
        ]
      };

      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Base Plans');
      expect(output).toContain('Committed Options');
      expect(output).toContain('90 Days');
      expect(output).toContain('901');
      expect(output).toContain('Price/Month');
    });

    it('renders committed options in deterministic JSON', () => {
      const result: LoadBalancerCommandResult = {
        action: 'plans',
        items: [
          {
            committed_sku: [
              {
                committed_days: 90,
                committed_node_message: 'Test message',
                committed_sku_id: 901,
                committed_sku_name: '90 Days',
                committed_sku_price: 5000,
                committed_upto_date: '2026-07-22'
              }
            ],
            disk: 50,
            hourly: 3,
            name: 'LB-2',
            price: 2000,
            ram: 4,
            template_id: 'plan-1',
            vcpu: 2
          }
        ]
      };

      expect(renderLoadBalancerResult(result, true)).toBe(
        stableStringify({
          action: 'plans',
          items: [
            {
              committed_sku: [
                {
                  committed_days: 90,
                  committed_node_message: 'Test message',
                  committed_sku_id: 901,
                  committed_sku_name: '90 Days',
                  committed_sku_price: 5000,
                  committed_upto_date: '2026-07-22'
                }
              ],
              disk: 50,
              hourly: 3,
              name: 'LB-2',
              price: 2000,
              ram: 4,
              template_id: 'plan-1',
              vcpu: 2
            }
          ]
        }) + '\n'
      );
    });
  });

  describe('delete', () => {
    it('renders cancelled message', () => {
      const result: LoadBalancerCommandResult = {
        action: 'delete',
        cancelled: true,
        lb_id: '42'
      };
      expect(renderLoadBalancerResult(result, false)).toBe(
        'Deletion cancelled.\n'
      );
    });

    it('renders deleted message', () => {
      const result: LoadBalancerCommandResult = {
        action: 'delete',
        cancelled: false,
        lb_id: '42',
        message: 'Resource deleted.'
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Load balancer deleted.');
      expect(output).toContain('42');
    });
  });

  describe('backend-group-list', () => {
    it('renders "No backend groups" when empty', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-list',
        lb_id: '10',
        lb_mode: 'HTTP',
        backends: [],
        tcp_backends: []
      };
      expect(renderLoadBalancerResult(result, false)).toContain(
        'No backend groups configured'
      );
    });

    it('renders ALB backend groups with server table', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-list',
        lb_id: '10',
        lb_mode: 'HTTP',
        backends: [
          {
            name: 'web',
            domain_name: 'example.com',
            backend_mode: 'http',
            balance: 'roundrobin',
            backend_ssl: false,
            http_check: true,
            check_url: '/health',
            servers: [
              {
                backend_name: 'srv-1',
                backend_ip: '10.0.0.1',
                backend_port: 8080
              }
            ]
          }
        ],
        tcp_backends: []
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('web');
      expect(output).toContain('roundrobin');
      expect(output).toContain('enabled');
      expect(output).toContain('1');
      expect(output).not.toContain('Backend Type');
    });

    it('renders NLB tcp backend groups', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-list',
        lb_id: '20',
        lb_mode: 'TCP',
        backends: [],
        tcp_backends: [
          {
            backend_name: 'tcp-grp',
            port: 8080,
            balance: 'leastconn',
            servers: [
              {
                backend_name: 'srv-1',
                backend_ip: '10.0.0.2',
                backend_port: 8080
              }
            ]
          }
        ]
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('tcp-grp');
      expect(output).toContain('leastconn');
    });

    it('renders JSON for backend-group-list', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-list',
        lb_id: '10',
        lb_mode: 'HTTP',
        backends: [],
        tcp_backends: []
      };
      const output = renderLoadBalancerResult(result, true);
      const parsed = JSON.parse(output) as { action: string; lb_id: string };
      expect(parsed.action).toBe('backend-group-list');
      expect(parsed.lb_id).toBe('10');
    });
  });

  describe('backend-group-create', () => {
    it('renders backend-group-create summary (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-create',
        group: {
          backend_port: null,
          health_check: false,
          name: 'api',
          protocol: 'HTTP',
          routing_policy: 'leastconn',
          servers: [
            {
              backend_name: 'api-1',
              backend_ip: '10.0.0.2',
              backend_port: 8080
            }
          ]
        },
        lb_id: '10',
        message: 'Backend group "api" created.'
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Backend group "api" created.');
      expect(output).toContain('Protocol');
      expect(output).toContain('HTTP');
      expect(output).toContain('api-1');
    });

    it('renders JSON for backend-group-create', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-create',
        group: {
          backend_port: null,
          health_check: true,
          name: 'api',
          protocol: 'HTTPS',
          routing_policy: 'leastconn',
          servers: []
        },
        lb_id: '10',
        message: 'Backend group "api" created.'
      };
      const output = renderLoadBalancerResult(result, true);
      const parsed = JSON.parse(output) as {
        action: string;
        group: { protocol: string };
        lb_id: string;
        message: string;
      };
      expect(parsed.action).toBe('backend-group-create');
      expect(parsed.group.protocol).toBe('HTTPS');
      expect(parsed.lb_id).toBe('10');
      expect(parsed.message).toBe('Backend group "api" created.');
    });

    it('renders Backend Port row when backend_port is set (NLB backend group)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-create',
        group: {
          backend_port: 8080,
          health_check: false,
          name: 'tcp-grp',
          protocol: 'TCP',
          routing_policy: 'roundrobin',
          servers: []
        },
        lb_id: '20',
        message: 'Backend group "tcp-grp" created.'
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Backend Port');
      expect(output).toContain('8080');
    });
  });

  describe('backend-server-add', () => {
    it('renders backend-server-add message (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-server-add',
        lb_id: '10',
        message: 'Server "srv-2" added to backend group "web".'
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Server "srv-2" added to backend group "web".');
      expect(output).toContain('10');
    });

    it('renders JSON for backend-server-add', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-server-add',
        lb_id: '10',
        message: 'Server "srv-2" added to backend group "web".'
      };
      const output = renderLoadBalancerResult(result, true);
      const parsed = JSON.parse(output) as {
        action: string;
        lb_id: string;
        message: string;
      };
      expect(parsed.action).toBe('backend-server-add');
      expect(parsed.lb_id).toBe('10');
      expect(parsed.message).toContain('srv-2');
    });
  });

  describe('backend-server-delete', () => {
    it('renders backend-server-delete message (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-server-delete',
        group_name: 'web',
        lb_id: '10',
        message: 'Server "srv-2" deleted from backend group "web".',
        server_name: 'srv-2'
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain(
        'Server "srv-2" deleted from backend group "web".'
      );
      expect(output).toContain('web');
      expect(output).toContain('srv-2');
    });

    it('renders JSON for backend-server-delete', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-server-delete',
        group_name: 'web',
        lb_id: '10',
        message: 'Server "srv-2" deleted from backend group "web".',
        server_name: 'srv-2'
      };
      const output = renderLoadBalancerResult(result, true);
      const parsed = JSON.parse(output) as {
        action: string;
        group_name: string;
        lb_id: string;
        message: string;
        server_name: string;
      };
      expect(parsed.action).toBe('backend-server-delete');
      expect(parsed.group_name).toBe('web');
      expect(parsed.server_name).toBe('srv-2');
    });
  });

  describe('backend-group-delete', () => {
    it('renders backend-group-delete message (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-delete',
        lb_id: '10',
        group_name: 'api',
        message: 'Backend group "api" deleted.'
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Backend group "api" deleted.');
      expect(output).toContain('10');
      expect(output).toContain('api');
    });

    it('renders JSON for backend-group-delete', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-delete',
        lb_id: '10',
        group_name: 'api',
        message: 'Backend group "api" deleted.'
      };
      const output = renderLoadBalancerResult(result, true);
      const parsed = JSON.parse(output) as {
        action: string;
        group_name: string;
        lb_id: string;
        message: string;
      };
      expect(parsed.action).toBe('backend-group-delete');
      expect(parsed.group_name).toBe('api');
      expect(parsed.lb_id).toBe('10');
      expect(parsed.message).toBe('Backend group "api" deleted.');
    });
  });

  describe('backend-server-list', () => {
    it('renders "No servers" when list is empty', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-server-list',
        lb_id: '10',
        group_name: 'web',
        servers: []
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('No servers in backend group "web".');
    });

    it('renders a server table when servers exist', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-server-list',
        lb_id: '10',
        group_name: 'web',
        servers: [
          { backend_name: 'srv-1', backend_ip: '10.0.0.1', backend_port: 8080 }
        ]
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('srv-1');
      expect(output).toContain('10.0.0.1');
      expect(output).toContain('8080');
    });

    it('renders JSON for backend-server-list', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-server-list',
        lb_id: '10',
        group_name: 'web',
        servers: [
          { backend_name: 'srv-1', backend_ip: '10.0.0.1', backend_port: 8080 }
        ]
      };
      const output = renderLoadBalancerResult(result, true);
      const parsed = JSON.parse(output) as {
        action: string;
        group_name: string;
        lb_id: string;
        servers: unknown[];
      };
      expect(parsed.action).toBe('backend-server-list');
      expect(parsed.group_name).toBe('web');
      expect(parsed.lb_id).toBe('10');
      expect(parsed.servers).toHaveLength(1);
    });
  });

  describe('delete JSON', () => {
    it('renders JSON for cancelled delete', () => {
      const result: LoadBalancerCommandResult = {
        action: 'delete',
        cancelled: true,
        lb_id: '42'
      };
      const output = renderLoadBalancerResult(result, true);
      const parsed = JSON.parse(output) as {
        action: string;
        cancelled: boolean;
        lb_id: string;
      };
      expect(parsed.action).toBe('delete');
      expect(parsed.cancelled).toBe(true);
      expect(parsed.lb_id).toBe('42');
    });

    it('renders JSON for completed delete', () => {
      const result: LoadBalancerCommandResult = {
        action: 'delete',
        cancelled: false,
        lb_id: '42',
        message: 'Resource deleted.'
      };
      const output = renderLoadBalancerResult(result, true);
      const parsed = JSON.parse(output) as {
        action: string;
        cancelled: boolean;
        lb_id: string;
        message: string;
      };
      expect(parsed.action).toBe('delete');
      expect(parsed.cancelled).toBe(false);
      expect(parsed.message).toBe('Resource deleted.');
    });
  });

  describe('plans edge cases', () => {
    it('renders "No load balancer plans available." when items is empty', () => {
      const result: LoadBalancerCommandResult = { action: 'plans', items: [] };
      expect(renderLoadBalancerResult(result, false)).toBe(
        'No load balancer plans available.\n'
      );
    });

    it('renders "No committed plans found." when committed_sku is empty', () => {
      const result: LoadBalancerCommandResult = {
        action: 'plans',
        items: [
          {
            committed_sku: [],
            disk: 50,
            hourly: 3,
            name: 'LB-2',
            price: 2000,
            ram: 4,
            template_id: 'plan-1',
            vcpu: 2
          }
        ]
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('No committed plans found.');
    });

    it('renders "--" for undefined committed_days', () => {
      const result: LoadBalancerCommandResult = {
        action: 'plans',
        items: [
          {
            committed_sku: [
              {
                committed_sku_id: 901,
                committed_sku_name: 'Flex',
                committed_sku_price: 5000
                // committed_days intentionally omitted
              }
            ],
            name: 'LB-2',
            price: 2000,
            template_id: 'plan-1'
          }
        ]
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Flex');
    });

    it('renders "--" for undefined plan price fields', () => {
      const result: LoadBalancerCommandResult = {
        action: 'plans',
        items: [
          {
            committed_sku: [],
            name: 'LB-2',
            price: undefined as unknown as number,
            template_id: 'plan-1',
            hourly: undefined,
            vcpu: undefined,
            ram: undefined,
            disk: undefined
          }
        ]
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('LB-2');
    });
  });

  describe('create with committed billing', () => {
    it('renders committed plan name in billing row', () => {
      const result: LoadBalancerCommandResult = {
        action: 'create',
        backend: {
          backend_port: null,
          health_check: false,
          name: 'web',
          protocol: 'HTTP',
          routing_policy: 'roundrobin',
          servers: []
        },
        billing: {
          committed_plan_id: 901,
          committed_plan_name: '90 Days',
          post_commit_behavior: 'auto_renew',
          type: 'committed'
        },
        requested: {
          frontend_port: 80,
          mode: 'HTTP',
          name: 'my-alb',
          plan_name: 'LB-2',
          type: 'external'
        },
        result: {
          appliance_id: 99,
          id: 'lb-99',
          resource_type: 'load_balancer',
          label_id: 'lbl-1'
        }
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Committed (90 Days)');
    });
  });
});
