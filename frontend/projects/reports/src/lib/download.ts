/** Hands a downloaded file to the browser under the given name. */
export function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The server's file name, faithtech-report-{city slug or all-cities}-{period}-{yyyy-MM-dd}.csv, with the city slug
 * of EventFileNames.Slug.
 */
export function reportFileName(city: string | null, period: string, at: string): string {
  const slug = city
    ? city
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
        .replace(/-+$/, '') || 'event'
    : 'all-cities';
  return `faithtech-report-${slug}-${period}-${at.slice(0, 10)}.csv`;
}
