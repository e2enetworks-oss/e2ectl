import { renderLoadBalancerResult } from '../../../src/load-balancer/formatter.js';
import { stableStringify } from '../../../src/core/json.js';
import type { LoadBalancerCommandResult } from '../../../src/load-balancer/service.js';

describe('renderLoadBalancerResult', () => {
  describe('list', () => {
    it('renders "No load balancers found." when list is empty', () => {
      const result: LoadBalancerCommandResult = { action: 'list', items: [] };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('No load balancers found.');
      expect(output).toContain('e2ectl lb plans');
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
            public_ip_reserved: true,
            private_ip: '10.0.0.1'
          }
        ]
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('my-alb');
      expect(output).toContain('RUNNING');
      expect(output).toContain('HTTP');
      expect(output).toContain('1.2.3.4 (Reserved)');
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
              public_ip_reserved: false,
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
      expect(output).toContain('srv-1 (10.0.0.1:8080)');
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
      expect(output).toContain('srv-1 (10.0.0.2:8080)');
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

  describe('backend-group-add', () => {
    it('renders backend-group-add summary (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-add',
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
        lb_name: 'my-lb',
        message: 'Backend group "api" added.'
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Backend group "api" added.');
      expect(output).toContain('Protocol');
      expect(output).toContain('HTTP');
      expect(output).toContain('api-1');
    });

    it('renders JSON for backend-group-add', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-add',
        group: {
          backend_port: null,
          health_check: true,
          name: 'api',
          protocol: 'HTTPS',
          routing_policy: 'leastconn',
          servers: []
        },
        lb_id: '10',
        lb_name: 'my-lb',
        message: 'Backend group "api" added.'
      };
      const output = renderLoadBalancerResult(result, true);
      const parsed = JSON.parse(output) as {
        action: string;
        group: { protocol: string };
        lb_id: string;
        message: string;
      };
      expect(parsed.action).toBe('backend-group-add');
      expect(parsed.group.protocol).toBe('HTTPS');
      expect(parsed.lb_id).toBe('10');
      expect(parsed.message).toBe('Backend group "api" added.');
    });

    it('renders Backend Port row when backend_port is set (NLB backend group)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-add',
        group: {
          backend_port: 8080,
          health_check: false,
          name: 'tcp-grp',
          protocol: 'TCP',
          routing_policy: 'roundrobin',
          servers: []
        },
        lb_id: '20',
        lb_name: 'my-nlb',
        message: 'Backend group "tcp-grp" added.'
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
        group_name: 'web',
        lb_id: '10',
        lb_name: 'my-lb',
        message: 'Server "srv-2" added to backend group "web".',
        server_name: 'srv-2'
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Server "srv-2" added to backend group "web".');
      expect(output).toContain('10');
    });

    it('renders JSON for backend-server-add', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-server-add',
        group_name: 'web',
        lb_id: '10',
        lb_name: 'my-lb',
        message: 'Server "srv-2" added to backend group "web".',
        server_name: 'srv-2'
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

  describe('backend-server-remove', () => {
    it('renders backend-server-remove message (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-server-remove',
        group_name: 'web',
        lb_id: '10',
        lb_name: 'my-lb',
        message: 'Server "srv-2" removed from backend group "web".',
        server_name: 'srv-2'
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain(
        'Server "srv-2" removed from backend group "web".'
      );
      expect(output).toContain('web');
      expect(output).toContain('srv-2');
    });

    it('renders JSON for backend-server-remove', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-server-remove',
        group_name: 'web',
        lb_id: '10',
        lb_name: 'my-lb',
        message: 'Server "srv-2" removed from backend group "web".',
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
      expect(parsed.action).toBe('backend-server-remove');
      expect(parsed.group_name).toBe('web');
      expect(parsed.server_name).toBe('srv-2');
    });
  });

  describe('backend-group-remove', () => {
    it('renders backend-group-remove message (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-remove',
        lb_id: '10',
        lb_name: 'my-lb',
        group_name: 'api',
        message: 'Backend group "api" removed.'
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Backend group "api" removed.');
      expect(output).toContain('10');
      expect(output).toContain('api');
    });

    it('renders JSON for backend-group-remove', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-remove',
        lb_id: '10',
        lb_name: 'my-lb',
        group_name: 'api',
        message: 'Backend group "api" removed.'
      };
      const output = renderLoadBalancerResult(result, true);
      const parsed = JSON.parse(output) as {
        action: string;
        group_name: string;
        lb_id: string;
        message: string;
      };
      expect(parsed.action).toBe('backend-group-remove');
      expect(parsed.group_name).toBe('api');
      expect(parsed.lb_id).toBe('10');
      expect(parsed.message).toBe('Backend group "api" removed.');
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

    it('renders "--" for absent optional plan fields', () => {
      const result: LoadBalancerCommandResult = {
        action: 'plans',
        items: [
          {
            committed_sku: [],
            name: 'LB-2',
            price: 2000,
            template_id: 'plan-1'
          }
        ]
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('LB-2');
      expect(output).toContain('--');
    });
  });

  describe('get', () => {
    it('renders load balancer details (human, no context)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'get',
        item: {
          id: 10,
          appliance_name: 'my-alb',
          status: 'RUNNING',
          lb_mode: 'HTTP',
          lb_type: 'external',
          public_ip: '1.2.3.4',
          public_ip_reserved: true,
          private_ip: null,
          context: undefined
        }
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Load balancer details.');
      expect(output).toContain('my-alb');
      expect(output).toContain('RUNNING');
      expect(output).toContain('1.2.3.4 (Reserved)');
      expect(output).toContain('e2ectl lb delete 10');
    });

    it('renders load balancer details with backends and VPC (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'get',
        item: {
          id: 20,
          appliance_name: 'my-alb-full',
          status: 'RUNNING',
          lb_mode: 'HTTP',
          lb_type: 'internal',
          public_ip: null,
          private_ip: '10.0.0.1',
          context: [
            {
              lb_port: '80',
              plan_name: 'E2E-LB-2',
              lb_reserve_ip: '5.5.5.5',
              ssl_context: {
                ssl_certificate_id: 99,
                redirect_to_https: true
              },
              vpc_list: [
                {
                  vpc_name: 'my-vpc',
                  network_id: 1,
                  ipv4_cidr: '10.0.0.0/24',
                  ip: '10.0.0.10',
                  subnet_name: 'subnet-a'
                }
              ],
              backends: [
                {
                  name: 'grp1',
                  backend_mode: 'http',
                  balance: 'roundrobin',
                  backend_ssl: false,
                  http_check: true,
                  check_url: '/',
                  domain_name: '',
                  servers: [
                    {
                      backend_name: 'web1',
                      backend_ip: '10.0.0.2',
                      backend_port: 8080
                    }
                  ]
                }
              ],
              tcp_backend: []
            }
          ]
        }
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('my-alb-full');
      expect(output).toContain('grp1');
      expect(output).toContain('web1 (10.0.0.2:8080)');
      expect(output).toContain('my-vpc');
      expect(output).toContain('5.5.5.5');
      expect(output).toContain('99');
      expect(output).toContain('HTTP→HTTPS Redirect');
    });

    it('renders load balancer details with TCP backends (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'get',
        item: {
          id: 30,
          appliance_name: 'my-nlb',
          status: 'RUNNING',
          lb_mode: 'TCP',
          lb_type: 'external',
          public_ip: '2.3.4.5',
          private_ip: null,
          context: [
            {
              lb_port: '3306',
              plan_name: 'E2E-LB-2',
              backends: [],
              tcp_backend: [
                {
                  backend_name: 'tcp-grp',
                  port: 3306,
                  balance: 'leastconn',
                  servers: [
                    {
                      backend_name: 'db1',
                      backend_ip: '10.0.0.5',
                      backend_port: 3306
                    }
                  ]
                }
              ]
            }
          ]
        }
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('my-nlb');
      expect(output).toContain('tcp-grp');
      expect(output).toContain('db1 (10.0.0.5:3306)');
    });

    it('renders JSON for get', () => {
      const result: LoadBalancerCommandResult = {
        action: 'get',
        item: {
          id: 10,
          appliance_name: 'my-alb',
          status: 'RUNNING',
          lb_mode: 'HTTP',
          lb_type: 'external',
          public_ip: '1.2.3.4',
          private_ip: null
        }
      };
      const parsed = JSON.parse(renderLoadBalancerResult(result, true)) as {
        action: string;
        item: { id: number };
      };
      expect(parsed.action).toBe('get');
      expect(parsed.item.id).toBe(10);
    });
  });

  describe('update', () => {
    it('renders update message with changed fields (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'update',
        lb_id: '10',
        lb_name: 'my-alb',
        message: 'Load balancer updated.',
        changes: {
          name: 'new-name',
          protocol: 'HTTPS',
          ssl_certificate_id: 42,
          redirect_http_to_https: true
        }
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Load balancer updated.');
      expect(output).toContain('new-name');
      expect(output).toContain('HTTPS');
      expect(output).toContain('42');
      expect(output).toContain('enabled');
      expect(output).toContain('e2ectl lb get 10');
    });

    it('renders update with no optional changes (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'update',
        lb_id: '10',
        lb_name: 'my-alb',
        message: 'Load balancer updated.',
        changes: {}
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Load balancer updated.');
      expect(output).toContain('10');
    });

    it('renders JSON for update', () => {
      const result: LoadBalancerCommandResult = {
        action: 'update',
        lb_id: '10',
        lb_name: 'my-alb',
        message: 'Load balancer updated.',
        changes: {}
      };
      const parsed = JSON.parse(renderLoadBalancerResult(result, true)) as {
        action: string;
        lb_id: string;
      };
      expect(parsed.action).toBe('update');
      expect(parsed.lb_id).toBe('10');
    });
  });

  describe('backend-group-update', () => {
    it('renders backend-group-update message (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-update',
        lb_id: '10',
        lb_name: 'my-alb',
        group_name: 'grp1',
        message: 'Backend group updated.',
        algorithm: 'leastconn',
        backend_protocol: 'HTTP'
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Backend group updated.');
      expect(output).toContain('grp1');
      expect(output).toContain('leastconn');
      expect(output).toContain('HTTP');
      expect(output).toContain('e2ectl lb get 10');
    });

    it('renders JSON for backend-group-update', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-update',
        lb_id: '10',
        lb_name: 'my-alb',
        group_name: 'grp1',
        message: 'Backend group updated.',
        algorithm: 'roundrobin'
      };
      const parsed = JSON.parse(renderLoadBalancerResult(result, true)) as {
        action: string;
        group_name: string;
      };
      expect(parsed.action).toBe('backend-group-update');
      expect(parsed.group_name).toBe('grp1');
    });
  });

  describe('backend-server-update', () => {
    it('renders backend-server-update with ip and port changes (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-server-update',
        lb_id: '10',
        lb_name: 'my-alb',
        group_name: 'grp1',
        server_name: 'web1',
        message: 'Backend server updated.',
        ip: '10.0.0.9',
        port: '9090'
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Backend server updated.');
      expect(output).toContain('web1');
      expect(output).toContain('10.0.0.9');
      expect(output).toContain('9090');
      expect(output).toContain('e2ectl lb get 10');
    });

    it('renders JSON for backend-server-update', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-server-update',
        lb_id: '10',
        lb_name: 'my-alb',
        group_name: 'grp1',
        server_name: 'web1',
        message: 'Backend server updated.',
        ip: '10.0.0.9'
      };
      const parsed = JSON.parse(renderLoadBalancerResult(result, true)) as {
        action: string;
        server_name: string;
      };
      expect(parsed.action).toBe('backend-server-update');
      expect(parsed.server_name).toBe('web1');
    });
  });

  describe('network actions', () => {
    it('renders network-reserve-ip-reserve (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'network-reserve-ip-reserve',
        lb_id: '10',
        lb_name: 'my-alb',
        message: 'IP reserved successfully.',
        reserve_ip: '5.5.5.5'
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('IP reserved successfully.');
      expect(output).toContain('5.5.5.5');
      expect(output).toContain('e2ectl lb get 10');
    });

    it('renders network-vpc-attach (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'network-vpc-attach',
        lb_id: '10',
        lb_name: 'my-alb',
        message: 'VPC attached.',
        vpc_id: 'vpc-1',
        subnet_id: 'sub-1'
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('VPC attached.');
      expect(output).toContain('vpc-1');
      expect(output).toContain('sub-1');
    });

    it('renders network-vpc-detach (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'network-vpc-detach',
        lb_id: '10',
        lb_name: 'my-alb',
        message: 'VPC detached.'
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('VPC detached.');
    });

    it('renders JSON for network actions', () => {
      const result: LoadBalancerCommandResult = {
        action: 'network-vpc-attach',
        lb_id: '10',
        lb_name: 'my-alb',
        message: 'VPC attached.',
        vpc_id: 'vpc-1'
      };
      const parsed = JSON.parse(renderLoadBalancerResult(result, true)) as {
        action: string;
        lb_id: string;
      };
      expect(parsed.action).toBe('network-vpc-attach');
      expect(parsed.lb_id).toBe('10');
    });
  });

  describe('backend-group-list with empty servers', () => {
    it('renders "--" when backend group has no servers (ALB)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-list',
        lb_id: '10',
        lb_mode: 'HTTP',
        backends: [
          {
            name: 'empty-grp',
            domain_name: '',
            backend_mode: 'http',
            balance: 'roundrobin',
            backend_ssl: false,
            http_check: false,
            check_url: '/',
            servers: []
          }
        ],
        tcp_backends: []
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('empty-grp');
      expect(output).toContain('--');
    });

    it('renders "--" when TCP backend group has no servers', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-list',
        lb_id: '20',
        lb_mode: 'TCP',
        backends: [],
        tcp_backends: [
          {
            backend_name: 'empty-tcp',
            port: 3306,
            balance: 'roundrobin',
            servers: []
          }
        ]
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('empty-tcp');
      expect(output).toContain('--');
    });
  });

  describe('get with backend_mode fallback and empty servers', () => {
    it('uses "http" fallback when backend_mode is undefined in get view', () => {
      const result: LoadBalancerCommandResult = {
        action: 'get',
        item: {
          id: 50,
          appliance_name: 'fallback-alb',
          status: 'RUNNING',
          lb_mode: 'HTTP',
          lb_type: 'external',
          public_ip: '1.2.3.4',
          private_ip: null,
          context: [
            {
              lb_port: '80',
              plan_name: 'LB-2',
              backends: [
                {
                  name: 'grp',
                  balance: 'roundrobin',
                  backend_ssl: false,
                  http_check: false,
                  check_url: '/',
                  domain_name: '',
                  servers: [
                    {
                      backend_name: 'web1',
                      backend_ip: '10.0.0.1',
                      backend_port: 8080
                    }
                  ]
                }
              ],
              tcp_backend: []
            }
          ]
        }
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('grp');
      expect(output).toContain('http');
    });

    it('renders "--" when backend group has no servers in get view', () => {
      const result: LoadBalancerCommandResult = {
        action: 'get',
        item: {
          id: 51,
          appliance_name: 'empty-alb',
          status: 'RUNNING',
          lb_mode: 'HTTP',
          lb_type: 'external',
          public_ip: '1.2.3.4',
          private_ip: null,
          context: [
            {
              lb_port: '80',
              plan_name: 'LB-2',
              backends: [
                {
                  name: 'grp',
                  backend_mode: 'http',
                  balance: 'roundrobin',
                  backend_ssl: false,
                  http_check: false,
                  check_url: '/',
                  domain_name: '',
                  servers: []
                }
              ],
              tcp_backend: []
            }
          ]
        }
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('grp');
      expect(output).toContain('--');
    });

    it('renders "--" when TCP backend group has no servers in get view', () => {
      const result: LoadBalancerCommandResult = {
        action: 'get',
        item: {
          id: 52,
          appliance_name: 'empty-nlb',
          status: 'RUNNING',
          lb_mode: 'TCP',
          lb_type: 'external',
          public_ip: '2.3.4.5',
          private_ip: null,
          context: [
            {
              lb_port: '3306',
              plan_name: 'LB-2',
              backends: [],
              tcp_backend: [
                {
                  backend_name: 'tcp-grp',
                  port: 3306,
                  balance: 'roundrobin',
                  servers: []
                }
              ]
            }
          ]
        }
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('tcp-grp');
      expect(output).toContain('--');
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
