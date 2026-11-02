import { HonorChosenBy, HubTitledItem } from '@faithtech-community/api';

import { clock } from './row-list';

const WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
];

const say = (n: number) => WORDS[n] ?? String(n);

const minutes = (n: number) => `${say(n)} ${n === 1 ? 'minute' : 'minutes'}`;

/** "Three minutes per team, then two minutes of questions.", built from the demo's numbers (L2-179 AC3). */
export function demoLine(perTeam: number | null, questions: number | null): string | null {
  if (!perTeam) return null;
  const line = minutes(perTeam);
  const first = line.charAt(0).toUpperCase() + line.slice(1);
  return questions
    ? `${first} per team, then ${minutes(questions)} of questions.`
    : `${first} per team.`;
}

/** "0:30 to 2:00" for each segment, from the start of the demo (L2-179 AC3). */
export function segmentTimes(seconds: number[]): string[] {
  let at = 0;
  return seconds.map((s) => {
    const from = at;
    at += s;
    return `${clock(from)} to ${clock(at)}`;
  });
}

/** A partner's initials for its icon tile, from the first two words of its name (Partners has no logo yet). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

const CHOSEN_BY: Record<HonorChosenBy, string> = {
  TopScore: 'Top score',
  JudgesPick: 'Judges’ pick',
  MentorsPick: 'Mentors’ pick',
  Vote: 'Everyone’s vote',
};

/** How an honor is chosen, as the hub and the wizard say it (L2-180). */
export function chosenByLabel(chosenBy: HonorChosenBy): string {
  return CHOSEN_BY[chosenBy];
}

export const CHOSEN_BY_OPTIONS = (Object.keys(CHOSEN_BY) as HonorChosenBy[]).map((value) => ({
  value,
  label: CHOSEN_BY[value],
}));

/** A stage's points from its textarea: one per line, "Title: detail" or a title alone (L2-177 AC1). */
export function parsePoints(text: string): HubTitledItem[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colon = line.indexOf(':');
      if (colon < 0) return { title: line, detail: null };
      const detail = line.slice(colon + 1).trim();
      return { title: line.slice(0, colon).trim(), detail: detail || null };
    });
}

/** The textarea's text for saved points. */
export function pointsText(points: readonly HubTitledItem[]): string {
  return points.map((p) => (p.detail ? `${p.title}: ${p.detail}` : p.title)).join('\n');
}
