// Traces to: L2-159 AC2, AC3, AC5 to AC7 (docs/detailed-designs/events/fill-in-hub-sections)
import {
  agendaInstant,
  agendaStates,
  agendaSummary,
  firstUpcomingRow,
  inTimeOrder,
  outsideWarning,
  parseSchedule,
  shiftOffer,
  timeInputInstant,
  timeInputValue,
} from './agenda';

/** 6:30 pm to 9:00 pm local, built in the test runner's own time zone. */
const local = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).toISOString();
const evening = { startsAt: local(6, 18, 30), endsAt: local(6, 21) };
const pastMidnight = { startsAt: local(6, 22), endsAt: local(7, 2) };

describe('agenda times', () => {
  it('reads a time on the event’s date', () => {
    expect(timeInputInstant('19:15', evening)).toBe(local(6, 19, 15));
    expect(timeInputValue(local(6, 19, 15))).toBe('19:15');
    expect(timeInputInstant('', evening)).toBeNull();
  });

  it('reads a time after midnight on the next day when the event runs past it', () => {
    expect(agendaInstant(0, 30, pastMidnight).toISOString()).toBe(local(7, 0, 30));
    expect(agendaInstant(23, 0, pastMidnight).toISOString()).toBe(local(6, 23));
  });

  it('warns about a row outside the event’s times', () => {
    expect(outsideWarning(local(6, 21, 30), evening)).toBe(
      'Outside the event’s times (6:30 pm to 9:00 pm)',
    );
    expect(outsideWarning(local(6, 21), evening)).toBeUndefined();
  });

  it('puts a row in time order, after any at the same time', () => {
    const rows = [{ startsAt: local(6, 18, 30) }, { startsAt: local(6, 20) }];
    const added = inTimeOrder(rows, { startsAt: local(6, 19) });
    expect(added.map((r) => r.startsAt)).toEqual([local(6, 18, 30), local(6, 19), local(6, 20)]);
  });

  it('sums up the rows for the review', () => {
    expect(
      agendaSummary([
        { startsAt: local(6, 18, 30), title: 'Doors open', detail: null },
        { startsAt: local(6, 21), title: 'Wrap up', detail: null },
      ]),
    ).toBe('2 rows, 6:30 pm to 9:00 pm');
    expect(agendaSummary([{ startsAt: local(6, 19), title: 'Talks', detail: null }])).toBe(
      '1 row, 7:00 pm',
    );
  });
});

describe('parseSchedule', () => {
  it('reads times with and without am or pm, and separators', () => {
    const { rows, unreadable } = parseSchedule(
      '6:30 Doors open\n7:15 pm Lightning talks\n19:45 – Demos\n9:00 Wrap up\n\n',
      evening,
    );

    expect(rows).toEqual([
      { startsAt: local(6, 18, 30), title: 'Doors open', detail: null },
      { startsAt: local(6, 19, 15), title: 'Lightning talks', detail: null },
      { startsAt: local(6, 19, 45), title: 'Demos', detail: null },
      { startsAt: local(6, 21), title: 'Wrap up', detail: null },
    ]);
    expect(unreadable).toEqual([]);
  });

  it('lists the lines it cannot read', () => {
    const { rows, unreadable } = parseSchedule(
      'speakers to be confirmed\nafter-party?\n25:00 Late\n7 Dinner\n' + `7:00 ${'x'.repeat(101)}`,
      evening,
    );

    expect(rows).toEqual([]);
    expect(unreadable).toHaveLength(5);
    expect(unreadable[0]).toBe('speakers to be confirmed');
  });

  it('reads 12-hour times as close to the start as it can when none is within the event', () => {
    const { rows } = parseSchedule('5:00 Setup', evening);
    expect(rows[0].startsAt).toBe(local(6, 17));
  });
});

// L2-168 AC1, AC2, AC4: each row runs to the next row's time, the last to the event's end, comparing instants.
describe('agendaStates', () => {
  const rows = [
    { startsAt: local(6, 18, 30) },
    { startsAt: local(6, 19) },
    { startsAt: local(6, 20) },
  ];
  const end = local(6, 21);
  const at = (h: number, m = 0) => new Date(local(6, h, m));

  it('marks the first row up next before the event starts, with nothing in progress', () => {
    expect(agendaStates(rows, end, at(18))).toEqual(['next', 'later', 'later']);
  });

  it('marks finished rows, the row in progress and the row after it', () => {
    expect(agendaStates(rows, end, at(19, 30))).toEqual(['finished', 'now', 'next']);
  });

  it('starts a row at its own time', () => {
    expect(agendaStates(rows, end, at(19))).toEqual(['finished', 'now', 'next']);
  });

  it('keeps the last row in progress until the event ends, with nothing up next', () => {
    expect(agendaStates(rows, end, at(20, 59))).toEqual(['finished', 'finished', 'now']);
  });

  it('finishes every row once the event has ended', () => {
    expect(agendaStates(rows, end, at(21))).toEqual(['finished', 'finished', 'finished']);
  });

  it('has no states for an empty agenda', () => {
    expect(agendaStates([], end, at(19))).toEqual([]);
  });
});

// L2-190 AC1, AC2: Move a session chooses the first row that hasn't started and words the offer to move the later rows.
describe('moving a session', () => {
  const rows = [
    { startsAt: '2026-11-06T23:30:00.000Z' },
    { startsAt: '2026-11-07T00:00:00.000Z' },
    { startsAt: '2026-11-07T01:00:00.000Z' },
  ];

  it('chooses the first row that hasn’t started, or the first when all have', () => {
    expect(firstUpcomingRow(rows, new Date('2026-11-06T20:00:00.000Z'))).toBe(0);
    expect(firstUpcomingRow(rows, new Date('2026-11-06T23:45:00.000Z'))).toBe(1);
    expect(firstUpcomingRow(rows, new Date('2026-11-07T03:00:00.000Z'))).toBe(0);
    expect(firstUpcomingRow([], new Date())).toBe(0);
  });

  it.each([
    [2, 30, 'Also move the 2 later sessions 30 minutes later'],
    [1, 30, 'Also move the later session 30 minutes later'],
    [3, -15, 'Also move the 3 later sessions 15 minutes earlier'],
    [2, 60, 'Also move the 2 later sessions 1 hour later'],
    [2, 1, 'Also move the 2 later sessions 1 minute later'],
    [2, 135, 'Also move the 2 later sessions 2 hours 15 minutes later'],
  ])('offers %i later rows moved by %i minutes as “%s”', (later, minutes, label) => {
    expect(shiftOffer(later, minutes)).toBe(label);
  });
});
