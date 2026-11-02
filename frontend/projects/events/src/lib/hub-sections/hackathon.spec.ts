// Traces to: L2-175 AC3, L2-177 AC2, L2-179 AC3, L2-180 AC3, L2-182 AC2 (docs/detailed-designs/events/build-hackathon-hub)
import {
  chosenByLabel,
  demoLine,
  initials,
  parsePoints,
  pointsText,
  segmentTimes,
} from './hackathon';

describe('hackathon displays', () => {
  it('says how long demos and questions run, in words', () => {
    expect(demoLine(3, 2)).toBe('Three minutes per team, then two minutes of questions.');
    expect(demoLine(1, 0)).toBe('One minute per team.');
    expect(demoLine(12, 1)).toBe('12 minutes per team, then one minute of questions.');
    expect(demoLine(null, 2)).toBeNull();
  });

  it('times each segment from the start of the demo', () => {
    expect(segmentTimes([30, 90, 30])).toEqual(['0:00 to 0:30', '0:30 to 2:00', '2:00 to 2:30']);
  });

  it('names a partner by the initials of their first two words', () => {
    expect(initials('Baptize The World')).toBe('BT');
    expect(initials('lantern')).toBe('L');
  });

  it('names how an honor is chosen', () => {
    expect(chosenByLabel('JudgesPick')).toBe('Judges’ pick');
    expect(chosenByLabel('Vote')).toBe('Everyone’s vote');
  });

  it('reads process points as "Title: detail" lines and writes them back', () => {
    const points = parsePoints('Listen: Whose pain have you heard?\n\n Remember ');
    expect(points).toEqual([
      { title: 'Listen', detail: 'Whose pain have you heard?' },
      { title: 'Remember', detail: null },
    ]);
    expect(pointsText(points)).toBe('Listen: Whose pain have you heard?\nRemember');
  });
});
