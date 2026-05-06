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
        description: 'db ingress',
        id: 57359,
        is_all_traffic_rule: false,
        is_default: false,
        name: 'db-sg',
        rules: [
          {
            description: 'mysql',
            id: null,
            network: 'any',
            network_cidr: '--',
            network_size: null,
            port_range: '3306',
            protocol_name: 'Custom_TCP',
            rule_type: 'Inbound',
            vpc_id: null
          }
        ]
      },
      {
        description: 'web ingress',
        id: 57358,
        is_all_traffic_rule: false,
        is_default: true,
        name: 'web-sg',
        rules: []
      }
    ]);

    expect(table).toContain('db-sg');
    expect(table).toContain('web-sg');
    expect(table).toContain('57358');
    expect(table).toContain('yes');
  });

  it('renders rule tables with descriptions', () => {
    const table = formatSecurityGroupRuleTable([
      {
        description: '',
        id: null,
        network: 'internal',
        network_cidr: '10.0.0.0/24',
        network_size: null,
        port_range: 'All',
        protocol_name: 'All',
        rule_type: 'Outbound',
        vpc_id: null
      },
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

    expect(table).toContain('10.0.0.0/24');
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

  it('renders fallback delete and create output when optional values are blank', () => {
    const deleteHuman = renderSecurityGroupResult(
      {
        action: 'delete',
        cancelled: false,
        security_group: {
          id: 57358,
          name: null
        }
      },
      false
    );
    const deleteJson = renderSecurityGroupResult(
      {
        action: 'delete',
        cancelled: false,
        security_group: {
          id: 57358,
          name: null
        }
      },
      true
    );

    expect(deleteHuman).toBe('Deleted security group 57358.\nMessage: \n');
    expect(deleteJson).toBe(
      `${stableStringify({
        action: 'delete',
        cancelled: false,
        message: '',
        security_group: {
          id: 57358,
          name: null
        }
      })}\n`
    );
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

  it('renders security-group details without any rules', () => {
    const output = renderSecurityGroupResult(
      {
        action: 'get',
        security_group: {
          description: 'web ingress',
          id: 57358,
          is_all_traffic_rule: false,
          is_default: false,
          name: 'web-sg',
          rules: []
        }
      },
      false
    );

    expect(output).toContain('ID: 57358');
    expect(output).toContain('Rules');
    expect(output).toContain('No rules found.');
  });

  it('renders security-group details with rules and all-traffic/default flags', () => {
    const output = renderSecurityGroupResult(
      {
        action: 'get',
        security_group: {
          description: 'all traffic',
          id: 57360,
          is_all_traffic_rule: true,
          is_default: true,
          name: 'all-sg',
          rules: [
            {
              description: '',
              id: null,
              network: 'any',
              network_cidr: '--',
              network_size: null,
              port_range: 'All',
              protocol_name: 'All',
              rule_type: 'Outbound',
              vpc_id: null
            }
          ]
        }
      },
      false
    );

    expect(output).toContain('Default: yes');
    expect(output).toContain('All Traffic Rule: yes');
    expect(output).toContain('Rules');
  });

  it('renders update output for humans and deterministic json', () => {
    const humanOutput = renderSecurityGroupResult(
      {
        action: 'update',
        message: 'Security Group updated successfully.',
        security_group: {
          description: 'web ingress',
          id: 57358,
          name: 'web-sg',
          rule_count: 3
        }
      },
      false
    );
    const jsonOutput = renderSecurityGroupResult(
      {
        action: 'update',
        message: 'Security Group updated successfully.',
        security_group: {
          description: 'web ingress',
          id: 57358,
          name: 'web-sg',
          rule_count: 3
        }
      },
      true
    );

    expect(humanOutput).toContain('Updated security group 57358.');
    expect(humanOutput).toContain('Rules: 3');
    expect(jsonOutput).toBe(
      `${stableStringify({
        action: 'update',
        message: 'Security Group updated successfully.',
        security_group: {
          description: 'web ingress',
          id: 57358,
          name: 'web-sg',
          rule_count: 3
        }
      })}\n`
    );
  });

  it('renders empty lists and cancelled deletes clearly', () => {
    const emptyListOutput = renderSecurityGroupResult(
      {
        action: 'list',
        items: []
      },
      false
    );
    const cancelledDeleteOutput = renderSecurityGroupResult(
      {
        action: 'delete',
        cancelled: true,
        security_group: {
          id: 57358,
          name: 'web-sg'
        }
      },
      false
    );

    expect(emptyListOutput).toBe('No security groups found.\n');
    expect(cancelledDeleteOutput).toBe('Deletion cancelled.\n');
  });

  it('renders deterministic json for cancelled delete', () => {
    const output = renderSecurityGroupResult(
      {
        action: 'delete',
        cancelled: true,
        security_group: {
          id: 57358,
          name: 'web-sg'
        }
      },
      true
    );

    expect(output).toBe(
      `${stableStringify({
        action: 'delete',
        cancelled: true,
        security_group: {
          id: 57358,
          name: 'web-sg'
        }
      })}\n`
    );
  });

  it('renders create human output with non-default security group', () => {
    const output = renderSecurityGroupResult(
      {
        action: 'create',
        message: 'Security Group created.',
        security_group: {
          description: '',
          id: 57361,
          is_default: false,
          label_id: null,
          name: 'custom-sg',
          resource_type: null,
          rule_count: 0
        }
      },
      false
    );

    expect(output).toContain('Default: no');
  });

  it('sorts rule table rows by id when both rules have non-null ids', () => {
    const table = formatSecurityGroupRuleTable([
      {
        description: 'http',
        id: 285097,
        network: 'any',
        network_cidr: '--',
        network_size: null,
        port_range: '80',
        protocol_name: 'Custom_TCP',
        rule_type: 'Inbound',
        vpc_id: null
      },
      {
        description: 'ssh',
        id: 285096,
        network: 'any',
        network_cidr: '--',
        network_size: null,
        port_range: '22',
        protocol_name: 'Custom_TCP',
        rule_type: 'Inbound',
        vpc_id: null
      }
    ]);

    expect(table.indexOf('22')).toBeLessThan(table.indexOf('80'));
  });
});
