import { dockerService } from '../src/services/dockerService';

describe('DockerService Engine Integration', () => {
  it('should initialize dockerService instance', () => {
    expect(dockerService).toBeDefined();
  });

  it('should fetch containers array without throwing unhandled exceptions', async () => {
    const containers = await dockerService.fetchContainers();
    expect(Array.isArray(containers)).toBe(true);
  });

  it('should fetch docker images array without throwing unhandled exceptions', async () => {
    const images = await dockerService.fetchImages();
    expect(Array.isArray(images)).toBe(true);
  });
});
