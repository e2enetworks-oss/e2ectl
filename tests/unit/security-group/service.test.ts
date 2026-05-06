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

function createServiceFixture(options?: {
  confirmResult?: boolean;
  isInteractive?: boolean;
}): {
  confirm: ReturnType<typeof vi.fn>;
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
  const confirm = vi.fn(() => Promise.resolve(options?.confirmResult ?? true));
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
    confirm,
    createSecurityGroupClient,
    isInteractive: options?.isInteractive ?? true,
    readRulesFile,
    readRulesFromStdin,
    store: {
      configPath: '/tmp/e2ectl-config.json',
      read: () => Promise.resolve(createConfig())
    }
  });

  return {
    confirm,
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

  it('reads rules from stdin when --rules-file - is used during create', async () => {
    const { createSecurityGroup, readRulesFromStdin, service } =
      createServiceFixture();

    createSecurityGroup.mockResolvedValue({
      message: 'Security Group created successfully.',
      result: {
        id: 57361,
        label_id: null,
        resource_type: null
      }
    });

    const result = await service.createSecurityGroup({
      alias: 'prod',
      name: 'stdin-sg',
      rulesFile: '-'
    });

    expect(readRulesFromStdin).toHaveBeenCalledTimes(1);
    expect(createSecurityGroup).toHaveBeenCalledWith({
      description: '',
      name: 'stdin-sg',
      rules: sampleRules()
    });
    expect(result).toEqual({
      action: 'create',
      message: 'Security Group created successfully.',
      security_group: {
        description: '',
        id: 57361,
        is_default: false,
        label_id: null,
        name: 'stdin-sg',
        resource_type: null,
        rule_count: 2
      }
    });
  });

  it('fails safe when created security-group ids cannot be resolved uniquely', async () => {
    const noMatches = createServiceFixture();
    noMatches.createSecurityGroup.mockResolvedValue({
      message: 'Security Group created successfully.',
      result: {
        id: null,
        label_id: null,
        resource_type: null
      }
    });
    noMatches.listSecurityGroups.mockResolvedValue([]);

    await expect(
      noMatches.service.createSecurityGroup({
        alias: 'prod',
        name: 'missing-id-sg',
        rulesFile: '/tmp/rules.json'
      })
    ).rejects.toMatchObject({
      code: 'SECURITY_GROUP_ID_LOOKUP_FAILED'
    });

    const duplicateMatches = createServiceFixture();
    duplicateMatches.createSecurityGroup.mockResolvedValue({
      message: 'Security Group created successfully.',
      result: {
        id: null,
        label_id: null,
        resource_type: null
      }
    });
    duplicateMatches.listSecurityGroups.mockResolvedValue([
      { ...sampleSummary(), name: 'duplicate-sg' },
      { ...sampleSummary(), id: 57360, name: 'duplicate-sg' }
    ]);

    await expect(
      duplicateMatches.service.createSecurityGroup({
        alias: 'prod',
        name: 'duplicate-sg',
        rulesFile: '/tmp/rules.json'
      })
    ).rejects.toMatchObject({
      code: 'SECURITY_GROUP_ID_LOOKUP_FAILED'
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

  it('uses an explicit update description without fetching the current security group', async () => {
    const { getSecurityGroup, service, updateSecurityGroup } =
      createServiceFixture();

    const result = await service.updateSecurityGroup('57358', {
      alias: 'prod',
      description: 'edge ingress',
      name: 'edge-sg',
      rulesFile: '/tmp/rules.json'
    });

    expect(getSecurityGroup).not.toHaveBeenCalled();
    expect(updateSecurityGroup).toHaveBeenCalledWith(57358, {
      description: 'edge ingress',
      name: 'edge-sg',
      rules: sampleRules()
    });
    expect(result).toEqual({
      action: 'update',
      message: 'Security Group updated successfully.',
      security_group: {
        description: 'edge ingress',
        id: 57358,
        name: 'edge-sg',
        rule_count: 2
      }
    });
  });

  it('normalizes blank descriptions during update without fetching the current security group', async () => {
    const { getSecurityGroup, service, updateSecurityGroup } =
      createServiceFixture();

    await service.updateSecurityGroup('57358', {
      alias: 'prod',
      description: '   ',
      name: 'blank-desc-sg',
      rulesFile: '/tmp/rules.json'
    });

    expect(getSecurityGroup).not.toHaveBeenCalled();
    expect(updateSecurityGroup).toHaveBeenCalledWith(57358, {
      description: '',
      name: 'blank-desc-sg',
      rules: sampleRules()
    });
  });

  it('falls back to an empty description when the backend returns null during update', async () => {
    const { getSecurityGroup, service, updateSecurityGroup } =
      createServiceFixture();

    getSecurityGroup.mockResolvedValue({
      ...sampleSummary(),
      description: null
    });

    const result = await service.updateSecurityGroup('57358', {
      alias: 'prod',
      name: 'web-sg',
      rulesFile: '/tmp/rules.json'
    });

    expect(updateSecurityGroup).toHaveBeenCalledWith(57358, {
      description: '',
      name: 'web-sg',
      rules: sampleRules()
    });
    expect(result.security_group.description).toBe('');
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

  it('rejects blank rules-file values before creating a client', async () => {
    const {
      createSecurityGroupClient,
      readRulesFile,
      readRulesFromStdin,
      service
    } = createServiceFixture();

    await expect(
      service.createSecurityGroup({
        alias: 'prod',
        name: 'web-sg',
        rulesFile: '   '
      })
    ).rejects.toMatchObject({
      message: 'Rules file cannot be empty.'
    });

    expect(createSecurityGroupClient).not.toHaveBeenCalled();
    expect(readRulesFile).not.toHaveBeenCalled();
    expect(readRulesFromStdin).not.toHaveBeenCalled();
  });

  it('rejects blank rules content before creating a client', async () => {
    const { createSecurityGroupClient, readRulesFile, service } =
      createServiceFixture();

    readRulesFile.mockResolvedValue('   ');

    await expect(
      service.createSecurityGroup({
        alias: 'prod',
        name: 'web-sg',
        rulesFile: '/tmp/empty-rules.json'
      })
    ).rejects.toMatchObject({
      message: 'Rules content cannot be empty.'
    });

    expect(createSecurityGroupClient).not.toHaveBeenCalled();
  });

  it('rejects rules content that is not a JSON array', async () => {
    const { createSecurityGroupClient, readRulesFile, service } =
      createServiceFixture();

    readRulesFile.mockResolvedValue(
      JSON.stringify({
        rule_type: 'Inbound'
      })
    );

    await expect(
      service.createSecurityGroup({
        alias: 'prod',
        name: 'web-sg',
        rulesFile: '/tmp/object-rules.json'
      })
    ).rejects.toMatchObject({
      message: 'Rules content must be a JSON array.'
    });

    expect(createSecurityGroupClient).not.toHaveBeenCalled();
  });

  it('rejects rule entries that are not backend-compatible objects', async () => {
    const { createSecurityGroupClient, readRulesFile, service } =
      createServiceFixture();

    readRulesFile.mockResolvedValue(JSON.stringify([null]));

    await expect(
      service.createSecurityGroup({
        alias: 'prod',
        name: 'web-sg',
        rulesFile: '/tmp/null-rule.json'
      })
    ).rejects.toMatchObject({
      message:
        'Rule 1 must be a JSON object compatible with the backend rule schema.'
    });

    expect(createSecurityGroupClient).not.toHaveBeenCalled();
  });

  it('wraps rule read failures from files and stdin with actionable errors', async () => {
    const fileFixture = createServiceFixture();
    fileFixture.readRulesFile.mockRejectedValue(new Error('permission denied'));

    await expect(
      fileFixture.service.createSecurityGroup({
        alias: 'prod',
        name: 'web-sg',
        rulesFile: '/tmp/missing-rules.json'
      })
    ).rejects.toMatchObject({
      code: 'RULES_FILE_READ_FAILED',
      message:
        'Could not read security-group rules file: /tmp/missing-rules.json'
    });

    const stdinFixture = createServiceFixture();
    stdinFixture.readRulesFromStdin.mockRejectedValue(new Error('broken pipe'));

    await expect(
      stdinFixture.service.createSecurityGroup({
        alias: 'prod',
        name: 'stdin-sg',
        rulesFile: '-'
      })
    ).rejects.toMatchObject({
      code: 'RULES_FILE_READ_FAILED',
      message: 'Could not read security-group rules from stdin.'
    });
  });

  it('rejects invalid security-group ids for get before client creation', async () => {
    const { createSecurityGroupClient, getSecurityGroup, service } =
      createServiceFixture();

    await expect(
      service.getSecurityGroup('web-sg', {
        alias: 'prod'
      })
    ).rejects.toMatchObject({
      code: 'INVALID_SECURITY_GROUP_ID',
      message: 'Security group ID must be numeric.'
    });

    expect(createSecurityGroupClient).not.toHaveBeenCalled();
    expect(getSecurityGroup).not.toHaveBeenCalled();
  });

  it('rejects invalid security-group ids for update before client creation', async () => {
    const { createSecurityGroupClient, updateSecurityGroup, service } =
      createServiceFixture();

    await expect(
      service.updateSecurityGroup('web-sg', {
        alias: 'prod',
        name: 'web-sg',
        rulesFile: '/tmp/rules.json'
      })
    ).rejects.toMatchObject({
      code: 'INVALID_SECURITY_GROUP_ID',
      message: 'Security group ID must be numeric.'
    });

    expect(createSecurityGroupClient).not.toHaveBeenCalled();
    expect(updateSecurityGroup).not.toHaveBeenCalled();
  });

  it('rejects security-group ids that exceed the safe integer range', async () => {
    const { createSecurityGroupClient, deleteSecurityGroup, service } =
      createServiceFixture();

    await expect(
      service.deleteSecurityGroup('9007199254740992', {
        alias: 'prod',
        force: true
      })
    ).rejects.toMatchObject({
      code: 'INVALID_SECURITY_GROUP_ID'
    });

    expect(createSecurityGroupClient).not.toHaveBeenCalled();
    expect(deleteSecurityGroup).not.toHaveBeenCalled();
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

  it('normalizes null backend fields when listing, getting, and deleting security groups', async () => {
    const {
      deleteSecurityGroup,
      getSecurityGroup,
      listSecurityGroups,
      service
    } = createServiceFixture();

    getSecurityGroup.mockResolvedValue({
      description: undefined,
      id: 57358,
      is_all_traffic_rule: undefined,
      is_default: false,
      name: 'web-sg',
      rules: [
        {
          description: undefined,
          id: undefined,
          network: undefined,
          network_cidr: undefined,
          network_size: undefined,
          port_range: undefined,
          protocol_name: undefined,
          rule_type: undefined,
          vpc_id: undefined
        }
      ]
    });
    listSecurityGroups.mockResolvedValue([
      {
        description: undefined,
        id: 57358,
        is_all_traffic_rule: undefined,
        is_default: false,
        name: 'web-sg',
        rules: undefined
      }
    ]);
    deleteSecurityGroup.mockResolvedValue({
      message: 'Security Group deleted successfully.',
      result: {
        name: null
      }
    });

    const getResult = await service.getSecurityGroup('57358', {
      alias: 'prod'
    });
    const listResult = await service.listSecurityGroups({ alias: 'prod' });
    const deleteResult = await service.deleteSecurityGroup('57358', {
      alias: 'prod',
      force: true
    });

    expect(getResult.security_group).toEqual({
      description: '',
      id: 57358,
      is_all_traffic_rule: false,
      is_default: false,
      name: 'web-sg',
      rules: [
        {
          description: '',
          id: null,
          network: '',
          network_cidr: '',
          network_size: null,
          port_range: '',
          protocol_name: '',
          rule_type: '',
          vpc_id: null
        }
      ]
    });
    expect(listResult.items).toEqual([
      {
        description: '',
        id: 57358,
        is_all_traffic_rule: false,
        is_default: false,
        name: 'web-sg',
        rules: []
      }
    ]);
    expect(deleteResult.security_group).toEqual({
      id: 57358,
      name: null
    });
  });

  it('returns a cancelled delete result when the confirmation prompt is declined', async () => {
    const { confirm, deleteSecurityGroup, service } = createServiceFixture({
      confirmResult: false
    });

    const result = await service.deleteSecurityGroup('57358', {
      alias: 'prod'
    });

    expect(confirm).toHaveBeenCalledWith(
      'Delete security group 57358? This cannot be undone.'
    );
    expect(deleteSecurityGroup).not.toHaveBeenCalled();
    expect(result).toEqual({
      action: 'delete',
      cancelled: true,
      security_group: {
        id: 57358,
        name: null
      }
    });
  });

  it('requires --force for delete in non-interactive mode', async () => {
    const { deleteSecurityGroup, service } = createServiceFixture({
      isInteractive: false
    });

    await expect(
      service.deleteSecurityGroup('57358', {
        alias: 'prod'
      })
    ).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      message:
        'Deleting a security group requires confirmation in an interactive terminal.'
    });

    expect(deleteSecurityGroup).not.toHaveBeenCalled();
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
