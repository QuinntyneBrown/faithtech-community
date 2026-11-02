// Traces to: L2-195 AC1 (docs/detailed-designs/events/share-hub-by-qr-code)
import { hubQrFileName } from './hub-qr-file-name';

describe('hubQrFileName', () => {
  it('names the image after the event, in lower-case words joined by hyphens', () => {
    expect(hubQrFileName('Toronto Builders Night')).toBe('toronto-builders-night-hub-qr-code.png');
    expect(hubQrFileName('Hackathon: Tech for Shelters!')).toBe(
      'hackathon-tech-for-shelters-hub-qr-code.png',
    );
    expect(hubQrFileName('  City Team Prayer & Planning  ')).toBe(
      'city-team-prayer-planning-hub-qr-code.png',
    );
  });

  it('falls back to "event" for a title with no letters or digits', () => {
    expect(hubQrFileName('!!!')).toBe('event-hub-qr-code.png');
  });
});
