import { formatFileSize } from './file-size';

describe('formatFileSize', () => {
  it('prints kilobytes, rounded up, under a megabyte', () => {
    expect(formatFileSize(10)).toBe('1 KB');
    expect(formatFileSize(640 * 1024)).toBe('640 KB');
  });

  it('prints megabytes with one decimal', () => {
    expect(formatFileSize(24.6 * 1024 * 1024)).toBe('24.6 MB');
  });
});
