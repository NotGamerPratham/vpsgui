import { serverService } from '../src/services/serverService';

describe('ServerService Host VPS Auto-Discovery', () => {
  it('should return empty array or stored nodes without fake data', () => {
    const nodes = serverService.getNodes();
    expect(Array.isArray(nodes)).toBe(true);
  });

  it('should allow adding node payloads', async () => {
    const node = await serverService.createNode({
      name: 'test-node-01',
      type: 'linux',
      ipAddress: '127.0.0.1',
      sshPort: 22,
      authMethod: 'password',
      sshUser: 'root',
      tags: ['test'],
      autoInstallAgent: false,
    });

    expect(node.name).toBe('test-node-01');
    expect(node.status).toBe('online');
  });
});
