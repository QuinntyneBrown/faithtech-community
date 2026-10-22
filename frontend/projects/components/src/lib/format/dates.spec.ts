import { formatDay, formatTimestamp } from './dates';

describe('date formats', () => {
  it('writes a day as "Tue 20 Oct", the mocks’ format', () => {
    expect(formatDay(new Date(2026, 9, 20, 12))).toBe('Tue 20 Oct');
    expect(formatDay('2026-11-03T12:00:00Z')).toMatch(/^\w{3} \d{1,2} Nov$/);
  });

  it('abbreviates September as the mocks do', () => {
    expect(formatDay(new Date(2026, 8, 22, 12))).toBe('Tue 22 Sep');
  });

  it('writes a timestamp as "2026-10-21 10:05" in local time', () => {
    expect(formatTimestamp(new Date(2026, 9, 21, 10, 5))).toBe('2026-10-21 10:05');
    expect(formatTimestamp(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02 03:04');
  });
});
