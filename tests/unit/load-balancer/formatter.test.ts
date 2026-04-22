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
            public_ip: '1.2.3.4'
          }
        ]
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('my-alb');
      expect(output).toContain('RUNNING');
      expect(output).toContain('HTTP');
      expect(output).toContain('1.2.3.4');
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
            public_ip: null
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
              public_ip: null,
              status: 'RUNNING'
            }
          ]
        }) + '\n'
      );
    });
  });

  describe('create', () => {
    it('renders confirmation with appliance id (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'create',
        result: {
          appliance_id: 99,
          id: 'lb-99',
          resource_type: 'load_balancer',
          label_id: 'lbl-1'
        }
      };
      const output = renderLoadBalancerResult(result, false);
      expect(output).toContain('Created load balancer');
      expect(output).toContain('99');
    });

    it('renders JSON for create', () => {
      const result: LoadBalancerCommandResult = {
        action: 'create',
        result: {
          appliance_id: 99,
          id: 'lb-99',
          resource_type: 'load_balancer',
          label_id: 'lbl-1'
        }
      };
      const output = renderLoadBalancerResult(result, true);
      const parsed = JSON.parse(output) as { action: string };
      expect(parsed.action).toBe('create');
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
      expect(output).toContain('42');
      expect(output).toContain('Resource deleted.');
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
      expect(output).toContain('Backend Group: web');
      expect(output).toContain('example.com');
      expect(output).toContain('srv-1');
      expect(output).toContain('10.0.0.1');
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
      expect(output).toContain('Backend Group: tcp-grp');
      expect(output).toContain('8080');
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
    it('renders backend-group-create message (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-create',
        lb_id: '10',
        message: 'Backend group "api" created.'
      };
      expect(renderLoadBalancerResult(result, false)).toBe(
        'Backend group "api" created.\n'
      );
    });

    it('renders JSON for backend-group-create', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-group-create',
        lb_id: '10',
        message: 'Backend group "api" created.'
      };
      const output = renderLoadBalancerResult(result, true);
      const parsed = JSON.parse(output) as {
        action: string;
        lb_id: string;
        message: string;
      };
      expect(parsed.action).toBe('backend-group-create');
      expect(parsed.lb_id).toBe('10');
      expect(parsed.message).toBe('Backend group "api" created.');
    });
  });

  describe('backend-server-add', () => {
    it('renders backend-server-add message (human)', () => {
      const result: LoadBalancerCommandResult = {
        action: 'backend-server-add',
        lb_id: '10',
        message: 'Server "srv-2" added to backend group "web".'
      };
      expect(renderLoadBalancerResult(result, false)).toBe(
        'Server "srv-2" added to backend group "web".\n'
      );
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
});
