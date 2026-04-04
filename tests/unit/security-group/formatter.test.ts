import { formatCliCommand } from '../../../src/app/metadata.js';
import { stableStringify } from '../../../src/core/json.js';
import {
  formatSecurityGroupListTable,
  formatSecurityGroupRuleTable,
  renderSecurityGroupResult
} from '../../../src/security-group/formatter.js';

describe('security-group formatter', () => {
  it('renders stable security-group list tables', () => {
    const table = formatSecurityGroupListTable([
      {
        description: 'web ingress',
        id: 57358,
        is_all_traffic_rule: false,
        is_default: true,
        name: 'web-sg',
        rules: []
      }
    ]);

    expect(table).toContain('web-sg');
    expect(table).toContain('57358');
    expect(table).toContain('yes');
  });

  it('renders rule tables with descriptions', () => {
    const table = formatSecurityGroupRuleTable([
      {
        description: 'ssh',
        id: 285096,
        network: 'any',
        network_cidr: '--',
        network_size: 1,
        port_range: '22',
        protocol_name: 'Custom_TCP',
        rule_type: 'Inbound',
        vpc_id: null
      }
    ]);

    expect(table).toContain('Custom_TCP');
    expect(table).toContain('22');
    expect(table).toContain('ssh');
  });

  it('renders create output with the next-step hint', () => {
    const output = renderSecurityGroupResult(
      {
        action: 'create',
        message: 'Security Group created successfully.',
        security_group: {
          description: '',
          id: 57358,
          is_default: true,
          label_id: null,
          name: 'web-sg',
          resource_type: null,
          rule_count: 2
        }
      },
      false
    );

    expect(output).toContain('Created security group: web-sg');
    expect(output).toContain('ID: 57358');
    expect(output).toContain('Rules: 2');
    expect(output).toContain(formatCliCommand('security-group list'));
  });

  it('sorts list json output for deterministic automation output', () => {
    const output = renderSecurityGroupResult(
      {
        action: 'list',
        items: [
          {
            description: '',
            id: 57359,
            is_all_traffic_rule: false,
            is_default: false,
            name: 'zebra-sg',
            rules: []
          },
          {
            description: '',
            id: 57358,
            is_all_traffic_rule: false,
            is_default: true,
            name: 'alpha-sg',
            rules: []
          }
        ]
      },
      true
    );

    expect(output).toBe(
      `${stableStringify({
        action: 'list',
        items: [
          {
            description: '',
            id: 57358,
            is_all_traffic_rule: false,
            is_default: true,
            name: 'alpha-sg',
            rules: []
          },
          {
            description: '',
            id: 57359,
            is_all_traffic_rule: false,
            is_default: false,
            name: 'zebra-sg',
            rules: []
          }
        ]
      })}\n`
    );
  });
});
