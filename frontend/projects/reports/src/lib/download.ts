/** Hands a downloaded file to the browser under the given name. */
export function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** EventFileNames.Slug: lower case, runs of anything else as one hyphen, at most 60 characters. */
function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '') || 'event'
  );
}

/**
 * The server's file name, {organisation}-report-{chapter or all-{chapters}}-{period}-{yyyy-MM-dd}.csv, with "all"
 * alone while chapters are off; every part slugged as EventFileNames.Slug does.
 */
export function reportFileName(
  organisation: string,
  chapterName: string | null,
  chaptersPlural: string | null,
  period: string,
  at: string,
): string {
  const scope = chapterName
    ? slug(chapterName)
    : chaptersPlural
      ? slug(`all ${chaptersPlural}`)
      : 'all';
  return `${slug(organisation)}-report-${scope}-${period}-${at.slice(0, 10)}.csv`;
}
