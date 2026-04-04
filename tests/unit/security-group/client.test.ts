import type {
  ApiEnvelope,
  ApiRequestOptions,
  MyAccountTransport
} from '../../../src/myaccount/index.js';
import { SecurityGroupApiClient } from '../../../src/security-group/client.js';
import type {
  SecurityGroupCreateRequest,
  SecurityGroupUpdateRequest
} from '../../../src/security-group/index.js';

class StubTransport implements MyAccountTransport {
  readonly deleteMock = vi.fn();
  readonly getMock = vi.fn();
  readonly postMock = vi.fn();
  readonly requestMock = vi.fn();

  delete<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'>
  ): Promise<TResponse> {
    return this.deleteMock(path, options) as Promise<TResponse>;
  }

  get<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'>
  ): Promise<TResponse> {
    return this.getMock(path, options) as Promise<TResponse>;
  }

  post<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'>
  ): Promise<TResponse> {
    return this.postMock(path, options) as Promise<TResponse>;
  }

  request<TResponse = ApiEnvelope<unknown>>(
    options: ApiRequestOptions<TResponse>
  ): Promise<TResponse> {
    return this.requestMock(options) as Promise<TResponse>;
  }
}

describe('SecurityGroupApiClient', () => {
  it('lists security groups through the resource collection path', async () => {
    const transport = new StubTransport();
    const client = new SecurityGroupApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope([
        {
          description: '',
          id: 57358,
          is_all_traffic_rule: false,
          is_default: false,
          name: 'web-sg',
          rules: []
        }
      ])
    );

    const result = await client.listSecurityGroups();

    expect(transport.getMock).toHaveBeenCalledWith(
      '/security_group/',
      undefined
    );
    expect(result[0]?.id).toBe(57358);
  });

  it('gets one security group through the detail path', async () => {
    const transport = new StubTransport();
    const client = new SecurityGroupApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope({
        description: 'web ingress',
        id: 57358,
        is_all_traffic_rule: false,
        is_default: false,
        name: 'web-sg',
        rules: []
      })
    );

    const result = await client.getSecurityGroup(57358);

    expect(transport.getMock).toHaveBeenCalledWith(
      '/security_group/57358/',
      undefined
    );
    expect(result.name).toBe('web-sg');
  });

  it('creates security groups through the resource collection path', async () => {
    const transport = new StubTransport();
    const client = new SecurityGroupApiClient(transport);
    const request: SecurityGroupCreateRequest = {
      default: true,
      description: '',
      name: 'web-sg',
      rules: sampleRules()
    };

    transport.postMock.mockResolvedValue(
      envelope(
        {
          id: 57358,
          label_id: null,
          resource_type: null
        },
        {
          message: 'Security Group created successfully.'
        }
      )
    );

    const result = await client.createSecurityGroup(request);

    expect(transport.postMock).toHaveBeenCalledWith('/security_group/', {
      body: request
    });
    expect(result).toEqual({
      message: 'Security Group created successfully.',
      result: {
        id: 57358,
        label_id: null,
        resource_type: null
      }
    });
  });

  it('updates security groups through the detail path with PUT', async () => {
    const transport = new StubTransport();
    const client = new SecurityGroupApiClient(transport);
    const request: SecurityGroupUpdateRequest = {
      description: 'web ingress',
      name: 'web-sg',
      rules: sampleRules()
    };

    transport.requestMock.mockResolvedValue(
      envelope('', {
        message: 'Security Group updated successfully.'
      })
    );

    const result = await client.updateSecurityGroup(57358, request);

    expect(transport.requestMock).toHaveBeenCalledWith({
      body: request,
      method: 'PUT',
      path: '/security_group/57358/'
    });
    expect(result).toEqual({
      message: 'Security Group updated successfully.'
    });
  });

  it('deletes security groups through the detail path', async () => {
    const transport = new StubTransport();
    const client = new SecurityGroupApiClient(transport);

    transport.deleteMock.mockResolvedValue(
      envelope(
        {
          name: 'web-sg'
        },
        {
          message: 'Security Group deleted successfully.'
        }
      )
    );

    const result = await client.deleteSecurityGroup(57358);

    expect(transport.deleteMock).toHaveBeenCalledWith(
      '/security_group/57358/',
      undefined
    );
    expect(result).toEqual({
      message: 'Security Group deleted successfully.',
      result: {
        name: 'web-sg'
      }
    });
  });

  it('attaches and detaches security groups through the node vm routes', async () => {
    const transport = new StubTransport();
    const client = new SecurityGroupApiClient(transport);

    transport.postMock
      .mockResolvedValueOnce(
        envelope({}, { message: 'Security Group Attached Successfully' })
      )
      .mockResolvedValueOnce(
        envelope({}, { message: 'Security Groups Detached Successfully' })
      );

    const attachResult = await client.attachNodeSecurityGroups(100157, {
      security_group_ids: [44, 45]
    });
    const detachResult = await client.detachNodeSecurityGroups(100157, {
      security_group_ids: [45]
    });

    expect(transport.postMock).toHaveBeenNthCalledWith(
      1,
      '/security_group/100157/attach/',
      {
        body: {
          security_group_ids: [44, 45]
        }
      }
    );
    expect(transport.postMock).toHaveBeenNthCalledWith(
      2,
      '/security_group/100157/detach/',
      {
        body: {
          security_group_ids: [45]
        }
      }
    );
    expect(attachResult).toEqual({
      message: 'Security Group Attached Successfully'
    });
    expect(detachResult).toEqual({
      message: 'Security Groups Detached Successfully'
    });
  });
});

function envelope<TData>(
  data: TData,
  overrides: Partial<ApiEnvelope<TData>> = {}
): ApiEnvelope<TData> {
  return {
    code: overrides.code ?? 200,
    data,
    errors: overrides.errors ?? {},
    message: overrides.message ?? 'Success'
  };
}

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
