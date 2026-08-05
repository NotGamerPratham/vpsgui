import { fileService } from '../src/services/fileService';

describe('FileService Host Filesystem Explorer', () => {
  it('should initialize fileService instance', () => {
    expect(fileService).toBeDefined();
  });

  it('should fetch files from specified path gracefully', async () => {
    const files = await fileService.fetchFiles('/var/www');
    expect(Array.isArray(files)).toBe(true);
  });
});
