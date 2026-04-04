import type {
  ConfigFile,
  ResolvedCredentials
} from '../../../src/config/index.js';
import { SecurityGroupService } from '../../../src/security-group/service.js';
import type { SecurityGroupClient } from '../../../src/security-group/index.js';

function createConfig(): ConfigFile {
  return {
    default: 'prod',
    profiles: {
      prod: {
        api_key: 'api-key',
        auth_token: 'auth-token',
        default_location: 'Delhi',
        default_project_id: '46429'
      }
    }
  };
}

function createServiceFixture(): {
  createSecurityGroup: ReturnType<typeof vi.fn>;
  createSecurityGroupClient: ReturnType<typeof vi.fn>;
  deleteSecurityGroup: ReturnType<typeof vi.fn>;
  getSecurityGroup: ReturnType<typeof vi.fn>;
  listSecurityGroups: ReturnType<typeof vi.fn>;
  readRulesFile: ReturnType<typeof vi.fn>;
  readRulesFromStdin: ReturnType<typeof vi.fn>;
  receivedCredentials: () => ResolvedCredentials | undefined;
  service: SecurityGroupService;
  updateSecurityGroup: ReturnType<typeof vi.fn>;
} {
  const createSecurityGroup = vi.fn(() =>
    Promise.resolve({
      message: 'Security Group created successfully.',
      result: {
        label_id: null,
        resource_type: null
      }
    })
  );
  const deleteSecurityGroup = vi.fn(() =>
    Promise.resolve({
      message: 'Security Group deleted successfully.',
      result: {
        name: 'web-sg'
      }
    })
  );
  const getSecurityGroup = vi.fn(() => Promise.resolve(sampleSummary()));
  const listSecurityGroups = vi.fn(() =>
    Promise.resolve([
      sampleSummary(),
      { ...sampleSummary(), id: 57359, name: 'db-sg' }
    ])
  );
  const updateSecurityGroup = vi.fn(() =>
    Promise.resolve({
      message: 'Security Group updated successfully.'
    })
  );
  const readRulesFile = vi.fn(() =>
    Promise.resolve(JSON.stringify(sampleRules()))
  );
  const readRulesFromStdin = vi.fn(() =>
    Promise.resolve(JSON.stringify(sampleRules()))
  );
  let credentials: ResolvedCredentials | undefined;

  const client: SecurityGroupClient = {
    attachNodeSecurityGroups: vi.fn(),
    createSecurityGroup,
    deleteSecurityGroup,
    detachNodeSecurityGroups: vi.fn(),
    getSecurityGroup,
    listSecurityGroups,
    updateSecurityGroup
  };
  const createSecurityGroupClient = vi.fn(
    (resolvedCredentials: ResolvedCredentials) => {
      credentials = resolvedCredentials;
      return client;
    }
  );
  const service = new SecurityGroupService({
    confirm: vi.fn(() => Promise.resolve(true)),
    createSecurityGroupClient,
    isInteractive: true,
    readRulesFile,
    readRulesFromStdin,
    store: {
      configPath: '/tmp/e2ectl-config.json',
      read: () => Promise.resolve(createConfig())
    }
  });

  return {
    createSecurityGroup,
    createSecurityGroupClient,
    deleteSecurityGroup,
    getSecurityGroup,
    listSecurityGroups,
    readRulesFile,
    readRulesFromStdin,
    receivedCredentials: () => credentials,
    service,
    updateSecurityGroup
  };
}

describe('SecurityGroupService', () => {
  it('lists security groups using resolved saved defaults', async () => {
    const { listSecurityGroups, receivedCredentials, service } =
      createServiceFixture();

    const result = await service.listSecurityGroups({ alias: 'prod' });

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      location: 'Delhi',
      project_id: '46429'
    });
    expect(listSecurityGroups).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      action: 'list',
      items: [
        summarize(sampleSummary()),
        summarize({ ...sampleSummary(), id: 57359, name: 'db-sg' })
      ]
    });
  });

  it('gets one security group through the detail path', async () => {
    const { getSecurityGroup, service } = createServiceFixture();

    const result = await service.getSecurityGroup('57358', { alias: 'prod' });

    expect(getSecurityGroup).toHaveBeenCalledWith(57358);
    expect(result).toEqual({
      action: 'get',
      security_group: summarize(sampleSummary())
    });
  });

  it('reads rules files locally before creating security groups', async () => {
    const { createSecurityGroup, listSecurityGroups, readRulesFile, service } =
      createServiceFixture();

    const result = await service.createSecurityGroup({
      alias: 'prod',
      default: true,
      name: 'web-sg',
      rulesFile: '/tmp/rules.json'
    });

    expect(readRulesFile).toHaveBeenCalledWith('/tmp/rules.json');
    expect(createSecurityGroup).toHaveBeenCalledWith({
      default: true,
      description: '',
      name: 'web-sg',
      rules: sampleRules()
    });
    expect(listSecurityGroups).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
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
    });
  });

  it('uses the backend-returned id directly when create already returns one', async () => {
    const { createSecurityGroup, listSecurityGroups, service } =
      createServiceFixture();

    createSecurityGroup.mockResolvedValue({
      message: 'Security Group created successfully.',
      result: {
        id: 57360,
        label_id: null,
        resource_type: null
      }
    });

    const result = await service.createSecurityGroup({
      alias: 'prod',
      name: 'api-sg',
      rulesFile: '/tmp/rules.json'
    });

    expect(listSecurityGroups).not.toHaveBeenCalled();
    expect(result).toEqual({
      action: 'create',
      message: 'Security Group created successfully.',
      security_group: {
        description: '',
        id: 57360,
        is_default: false,
        label_id: null,
        name: 'api-sg',
        resource_type: null,
        rule_count: 2
      }
    });
  });

  it('preserves the current description when update omits --description', async () => {
    const {
      getSecurityGroup,
      readRulesFromStdin,
      service,
      updateSecurityGroup
    } = createServiceFixture();

    const result = await service.updateSecurityGroup('57358', {
      alias: 'prod',
      name: 'web-sg',
      rulesFile: '-'
    });

    expect(getSecurityGroup).toHaveBeenCalledWith(57358);
    expect(readRulesFromStdin).toHaveBeenCalledTimes(1);
    expect(updateSecurityGroup).toHaveBeenCalledWith(57358, {
      description: 'web ingress',
      name: 'web-sg',
      rules: sampleRules()
    });
    expect(result).toEqual({
      action: 'update',
      message: 'Security Group updated successfully.',
      security_group: {
        description: 'web ingress',
        id: 57358,
        name: 'web-sg',
        rule_count: 2
      }
    });
  });

  it('rejects invalid rules JSON before creating a client', async () => {
    const { createSecurityGroupClient, readRulesFile, service } =
      createServiceFixture();

    readRulesFile.mockResolvedValue('{');

    await expect(
      service.createSecurityGroup({
        alias: 'prod',
        name: 'web-sg',
        rulesFile: '/tmp/bad-rules.json'
      })
    ).rejects.toMatchObject({
      message: 'Rules content is not valid JSON.'
    });

    expect(createSecurityGroupClient).not.toHaveBeenCalled();
  });

  it('rejects invalid local update input before client or network work', async () => {
    const {
      createSecurityGroupClient,
      getSecurityGroup,
      readRulesFile,
      service
    } = createServiceFixture();

    readRulesFile.mockResolvedValue('{');

    await expect(
      service.updateSecurityGroup('57358', {
        alias: 'prod',
        name: 'web-sg',
        rulesFile: '/tmp/bad-rules.json'
      })
    ).rejects.toMatchObject({
      message: 'Rules content is not valid JSON.'
    });

    expect(createSecurityGroupClient).not.toHaveBeenCalled();
    expect(getSecurityGroup).not.toHaveBeenCalled();
  });

  it('deletes one security group with an explicit force flag', async () => {
    const { deleteSecurityGroup, service } = createServiceFixture();

    const result = await service.deleteSecurityGroup('57358', {
      alias: 'prod',
      force: true
    });

    expect(deleteSecurityGroup).toHaveBeenCalledWith(57358);
    expect(result).toEqual({
      action: 'delete',
      cancelled: false,
      message: 'Security Group deleted successfully.',
      security_group: {
        id: 57358,
        name: 'web-sg'
      }
    });
  });
});

function sampleRules() {
  return [
    {
      description: 'ssh',
      network: 'any',
      port_range: '22',
      protocol_name: 'Custom_TCP',
      rule_type: 'Inbound'
    },
    {
      description: '',
      network: 'any',
      port_range: 'All',
      protocol_name: 'All',
      rule_type: 'Outbound'
    }
  ];
}

function sampleSummary() {
  return {
    description: 'web ingress',
    id: 57358,
    is_all_traffic_rule: false,
    is_default: false,
    name: 'web-sg',
    rules: [
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
      },
      {
        description: '',
        id: 285097,
        network: 'any',
        network_cidr: '--',
        network_size: 1,
        port_range: 'All',
        protocol_name: 'All',
        rule_type: 'Outbound',
        vpc_id: null
      }
    ]
  };
}

function summarize(summary: ReturnType<typeof sampleSummary>) {
  return {
    description: summary.description,
    id: summary.id,
    is_all_traffic_rule: summary.is_all_traffic_rule,
    is_default: summary.is_default,
    name: summary.name,
    rules: summary.rules.map((rule) => ({
      description: rule.description,
      id: rule.id,
      network: rule.network,
      network_cidr: rule.network_cidr,
      network_size: rule.network_size,
      port_range: rule.port_range,
      protocol_name: rule.protocol_name,
      rule_type: rule.rule_type,
      vpc_id: rule.vpc_id
    }))
  };
}
