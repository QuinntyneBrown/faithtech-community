/**
 * The downloaded QR code's file name (L2-195 AC1): the event's title in lower case, every run of characters
 * that are not letters or digits made one hyphen, then "-hub-qr-code.png"; "event" when nothing is left.
 */
export function hubQrFileName(eventTitle: string): string {
  const slug = eventTitle
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'event'}-hub-qr-code.png`;
}
