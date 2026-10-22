import {
  formatDay,
  formatDayRange,
  formatFeedTime,
  formatMonth,
  formatNoticeTime,
  formatTime,
  formatTimeRange,
  formatTimestamp,
} from './dates';

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

  it('writes a notice time as "Today, 11:42 am" today and as a day before that', () => {
    const now = new Date(2026, 9, 21, 15, 0);
    expect(formatNoticeTime(new Date(2026, 9, 21, 11, 42), now)).toBe('Today, 11:42 am');
    expect(formatNoticeTime(new Date(2026, 9, 21, 14, 5), now)).toBe('Today, 2:05 pm');
    expect(formatNoticeTime(new Date(2026, 9, 21, 0, 7), now)).toBe('Today, 12:07 am');
    expect(formatNoticeTime(new Date(2026, 9, 20, 23, 59), now)).toBe('Tue 20 Oct');
  });

  it('writes a time as "6:30 pm", the mocks’ format, in local time', () => {
    expect(formatTime(new Date(2026, 10, 6, 18, 30))).toBe('6:30 pm');
    expect(formatTime(new Date(2026, 10, 6, 0, 5))).toBe('12:05 am');
    expect(formatTime(new Date(2026, 10, 6, 12, 0))).toBe('12:00 pm');
  });

  it('writes a short month as "Nov" for the date badge', () => {
    expect(formatMonth(new Date(2026, 10, 6))).toBe('Nov');
    expect(formatMonth(new Date(2026, 8, 6))).toBe('Sep');
  });

  it('writes a day range as "Sat 14 – Sun 15 Nov", or one day when it ends that day', () => {
    expect(formatDayRange(new Date(2026, 10, 14, 9), new Date(2026, 10, 15, 17))).toBe(
      'Sat 14 – Sun 15 Nov',
    );
    expect(formatDayRange(new Date(2026, 9, 31, 9), new Date(2026, 10, 1, 17))).toBe(
      'Sat 31 Oct – Sun 1 Nov',
    );
    expect(formatDayRange(new Date(2026, 10, 6, 18), new Date(2026, 10, 6, 21))).toBe('Fri 6 Nov');
  });

  it('writes when an event runs, with the year: "Fri 6 Nov 2026 · 6:30 – 9:00 pm"', () => {
    expect(formatTimeRange(new Date(2026, 10, 6, 18, 30), new Date(2026, 10, 6, 21))).toBe(
      'Fri 6 Nov 2026 · 6:30 – 9:00 pm',
    );
    expect(formatTimeRange(new Date(2026, 10, 6, 10), new Date(2026, 10, 6, 13))).toBe(
      'Fri 6 Nov 2026 · 10:00 am – 1:00 pm',
    );
    expect(formatTimeRange(new Date(2026, 10, 14, 9), new Date(2026, 10, 15, 17))).toBe(
      'Sat 14 – Sun 15 Nov 2026',
    );
  });

  it('writes when activity happened: "Today, 11:42 am", "Yesterday, 4:10 pm", then "Mon 19 Oct"', () => {
    const now = new Date(2026, 9, 21, 15, 0);
    expect(formatFeedTime(new Date(2026, 9, 21, 11, 42), now)).toBe('Today, 11:42 am');
    expect(formatFeedTime(new Date(2026, 9, 20, 16, 10), now)).toBe('Yesterday, 4:10 pm');
    expect(formatFeedTime(new Date(2026, 9, 19, 9, 0), now)).toBe('Mon 19 Oct');
    expect(formatFeedTime(new Date(2026, 0, 1, 0, 30), new Date(2026, 0, 2, 8))).toBe(
      'Yesterday, 12:30 am',
    );
  });
});
