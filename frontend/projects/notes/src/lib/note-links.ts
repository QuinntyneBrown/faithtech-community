/** An absolute https URL of at most 2,000 characters (L2-087 AC9). */
export function isHttps(value: string): boolean {
  return isUrl(value, ['https:']);
}

/** An https or mailto link of at most 2,000 characters (L2-088 AC3). */
export function isHyperlink(value: string): boolean {
  return isUrl(value, ['https:', 'mailto:']);
}

function isUrl(value: string, protocols: string[]): boolean {
  if (!value || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) && (url.protocol === 'mailto:' || !!url.hostname);
  } catch {
    return false;
  }
}
