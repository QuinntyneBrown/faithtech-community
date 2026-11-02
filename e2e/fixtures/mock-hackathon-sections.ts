/**
 * The ten optional hub section kinds as the API keeps them (ADR 0042, L2-172 to L2-182): each kind's rules and messages
 * follow HackathonSections.cs; Partners, maps and slides are read live from the partners and resources fakes.
 */

export const OPTIONAL_HUB_SECTION_KINDS = [
  'Parking',
  'WhatToBring',
  'Partners',
  'Tracks',
  'Process',
  'Rules',
  'DemoFormat',
  'Judging',
  'Worship',
  'Slides',
] as const;

export type OptionalHubSectionKind = (typeof OPTIONAL_HUB_SECTION_KINDS)[number];

/** A resource a hub may show: an image or a PDF from Resources. */
export interface HubFileResource {
  id: string;
  title: string;
  kind: 'Image' | 'Pdf';
}

/** What the optional kinds read from the rest of the fake. */
export interface HackathonDirectory {
  /** An active partner of the organisation. */
  partner(id: string): { id: string; name: string; offering: string | null; website: string | null } | undefined;
  /** An active file resource of the organisation the caller may open, as Image or Pdf; undefined for anything else. */
  file(id: string, callerId: string | null): HubFileResource | undefined;
}

type Errors = Record<string, string[]>;
type Content = Record<string, unknown>;

const HTTPS = 'Use a link that starts with https://';
const CHOSEN_BY = ['TopScore', 'JudgesPick', 'MentorsPick', 'Vote'];

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().replace(/[ \t]+/g, ' ') : null;

const list = (value: unknown): Content[] => (Array.isArray(value) ? (value as Content[]) : []);

const strings = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function isHttps(value: unknown): boolean {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim()))
    return true;
  if (typeof value !== 'string' || value.trim().length > 500) return false;
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const minutes = (n: number) => (n === 1 ? '1 minute' : `${n} minutes`);

/** Validates and normalises one optional kind's content, as the API does. */
export function validateOptional(
  kind: OptionalHubSectionKind,
  body: Content,
  directory: HackathonDirectory,
  callerId: string | null,
): { content?: Content; errors?: Errors } {
  const errors: Errors = {};
  const add = (field: string, message: string) => (errors[field] ??= [message]);
  const within = (field: string, value: unknown, max: number) => {
    if (typeof value === 'string' && value.trim().length > max)
      add(field, `Use ${max} characters or fewer.`);
  };
  const required = (field: string, value: unknown, message: string, max: number) => {
    if (!text(value)) add(field, message);
    else within(field, value, max);
  };
  const atMost = (field: string, items: unknown[], max: number, what: string) => {
    if (items.length > max) add(field, `You can add up to ${max} ${what}.`);
  };
  const titled = (field: string, items: Content[], message: string, titleMax: number, detailMax: number) =>
    items.forEach((item, i) => {
      required(`${field}[${i}].title`, item['title'], message, titleMax);
      within(`${field}[${i}].detail`, item['detail'], detailMax);
    });
  const items = (value: unknown) =>
    list(value).map((i) => ({ title: text(i['title']), detail: text(i['detail']) }));

  let content: Content = {};
  switch (kind) {
    case 'Parking': {
      const options = list(body['options']);
      within('note', body['note'], 300);
      atMost('options', options, 6, 'options');
      options.forEach((o, i) => {
        required(`options[${i}].title`, o['title'], 'Name this option.', 80);
        within(`options[${i}].notes`, o['notes'], 300);
      });
      if (!Object.keys(errors).length)
        options.forEach((o, i) => {
          const id = o['mapResourceId'];
          if (id && directory.file(String(id), callerId)?.kind !== 'Image')
            add(`options[${i}].mapResourceId`, 'Choose an image.');
        });
      content = {
        note: text(body['note']),
        options: options.map((o) => ({
          title: text(o['title']),
          notes: text(o['notes']),
          mapResourceId: o['mapResourceId'] ? String(o['mapResourceId']) : null,
        })),
      };
      break;
    }
    case 'WhatToBring': {
      const bring = strings(body['bring']);
      const onTheDay = list(body['onTheDay']);
      atMost('bring', bring, 15, 'things to bring');
      bring.forEach((b, i) => required(`bring[${i}]`, b, 'Say what to bring.', 120));
      atMost('onTheDay', onTheDay, 10, 'items');
      titled('onTheDay', onTheDay, 'Give this a title.', 60, 160);
      content = { bring: bring.map(text), onTheDay: items(onTheDay) };
      break;
    }
    case 'Partners': {
      const ids = [...new Set(strings(body['partnerIds']).map(String))];
      if (ids.length > 6) add('partnerIds', 'You can pick up to 6 partners.');
      within('meet', body['meet'], 400);
      if (!Object.keys(errors).length && ids.some((id) => !directory.partner(id)))
        add('partnerIds', 'Choose a partner from the list.');
      content = { partnerIds: ids, meet: text(body['meet']) };
      break;
    }
    case 'Tracks': {
      const tracks = list(body['tracks']);
      const good = list(body['goodLooksLike']);
      atMost('tracks', tracks, 6, 'tracks');
      if (tracks.filter((t) => t['primary'] === true).length > 1)
        add('tracks', 'Mark one track as primary.');
      tracks.forEach((t, i) => {
        required(`tracks[${i}].title`, t['title'], 'Name this track.', 80);
        required(`tracks[${i}].brief`, t['brief'], 'Add the track’s brief.', 400);
        if (!isHttps(t['linkUrl'])) add(`tracks[${i}].linkUrl`, HTTPS);
        within(`tracks[${i}].linkText`, t['linkText'], 60);
      });
      atMost('goodLooksLike', good, 6, 'marks');
      titled('goodLooksLike', good, 'Give this a title.', 60, 160);
      content = {
        tracks: tracks.map((t) => ({
          title: text(t['title']),
          brief: text(t['brief']),
          linkUrl: text(t['linkUrl']),
          linkText: text(t['linkText']),
          primary: t['primary'] === true,
        })),
        goodLooksLike: items(good),
      };
      break;
    }
    case 'Process': {
      const stages = list(body['stages']);
      within('name', body['name'], 60);
      within('intro', body['intro'], 300);
      atMost('stages', stages, 8, 'stages');
      stages.forEach((s, i) => {
        required(`stages[${i}].title`, s['title'], 'Name this stage.', 40);
        within(`stages[${i}].when`, s['when'], 40);
        within(`stages[${i}].summary`, s['summary'], 160);
        const points = list(s['points']);
        atMost(`stages[${i}].points`, points, 6, 'points');
        titled(`stages[${i}].points`, points, 'Give this point a title.', 40, 160);
      });
      content = {
        name: text(body['name']),
        intro: text(body['intro']),
        stages: stages.map((s) => ({
          title: text(s['title']),
          when: text(s['when']),
          summary: text(s['summary']),
          points: items(s['points']),
        })),
      };
      break;
    }
    case 'Rules': {
      const rules = list(body['rules']);
      atMost('rules', rules, 12, 'rules');
      titled('rules', rules, 'Name this rule.', 60, 160);
      within('note', body['note'], 300);
      content = { rules: items(rules), note: text(body['note']) };
      break;
    }
    case 'DemoFormat': {
      const segments = list(body['segments']);
      const tips = strings(body['tips']);
      const m = body['minutes'];
      const q = body['questionMinutes'];
      const total = segments.reduce((sum, s) => sum + (Number(s['seconds']) || 0), 0);
      if (m !== null && m !== undefined && !(Number(m) >= 1 && Number(m) <= 30))
        add('minutes', 'Choose between 1 and 30 minutes.');
      if (q !== null && q !== undefined && !(Number(q) >= 0 && Number(q) <= 30))
        add('questionMinutes', 'Choose between 0 and 30 minutes.');
      atMost('segments', segments, 8, 'segments');
      if (typeof m === 'number' && m >= 1 && m <= 30 && total > m * 60)
        add('segments', `The segments run ${clock(total)}. Make them fit in ${minutes(m)}.`);
      segments.forEach((s, i) => {
        required(`segments[${i}].title`, s['title'], 'Name this segment.', 60);
        within(`segments[${i}].detail`, s['detail'], 120);
        const seconds = s['seconds'];
        if (seconds === null || seconds === undefined)
          add(`segments[${i}].seconds`, 'Choose how long it runs.');
        else if (!(Number(seconds) >= 15 && Number(seconds) <= 1800))
          add(`segments[${i}].seconds`, 'Choose between 15 and 1800 seconds.');
      });
      atMost('tips', tips, 5, 'tips');
      tips.forEach((t, i) => required(`tips[${i}]`, t, 'Write the tip.', 80));
      content = {
        minutes: m ?? null,
        questionMinutes: q ?? null,
        segments: segments.map((s) => ({
          title: text(s['title']),
          detail: text(s['detail']),
          seconds: Number(s['seconds']),
        })),
        tips: tips.map(text),
      };
      break;
    }
    case 'Judging': {
      const criteria = list(body['criteria']);
      const honors = list(body['honors']);
      const top = body['topScore'];
      if (top !== null && top !== undefined && !(Number(top) >= 3 && Number(top) <= 10))
        add('topScore', 'Choose between 3 and 10.');
      atMost('criteria', criteria, 6, 'criteria');
      const total = criteria.reduce((sum, c) => sum + (Number(c['weight']) || 0), 0);
      if (criteria.length && total !== 100)
        add('criteria', `Weights add up to ${total}%. Make them total 100%.`);
      criteria.forEach((c, i) => {
        required(`criteria[${i}].title`, c['title'], 'Name this criterion.', 60);
        within(`criteria[${i}].question`, c['question'], 200);
        within(`criteria[${i}].topMark`, c['topMark'], 200);
        const weight = c['weight'];
        if (weight === null || weight === undefined) add(`criteria[${i}].weight`, 'Give it a weight.');
        else if (!(Number(weight) >= 1 && Number(weight) <= 100))
          add(`criteria[${i}].weight`, 'Choose between 1 and 100.');
      });
      atMost('honors', honors, 6, 'honors');
      honors.forEach((h, i) => {
        required(`honors[${i}].title`, h['title'], 'Name this honor.', 60);
        within(`honors[${i}].line`, h['line'], 160);
        if (!CHOSEN_BY.some((v) => v.toLowerCase() === String(h['chosenBy'] ?? '').toLowerCase()))
          add(`honors[${i}].chosenBy`, 'Choose how it’s chosen.');
      });
      within('note', body['note'], 200);
      content = {
        topScore: top ?? null,
        criteria: criteria.map((c) => ({
          title: text(c['title']),
          question: text(c['question']),
          topMark: text(c['topMark']),
          weight: Number(c['weight']),
        })),
        honors: honors.map((h) => ({
          title: text(h['title']),
          line: text(h['line']),
          chosenBy: CHOSEN_BY.find((v) => v.toLowerCase() === String(h['chosenBy']).toLowerCase()),
        })),
        note: text(body['note']),
      };
      break;
    }
    case 'Worship': {
      const songs = list(body['songs']);
      within('note', body['note'], 200);
      atMost('songs', songs, 10, 'songs');
      songs.forEach((s, i) => {
        required(`songs[${i}].title`, s['title'], 'Name the song.', 80);
        within(`songs[${i}].artist`, s['artist'], 80);
        if (!isHttps(s['url'])) add(`songs[${i}].url`, HTTPS);
      });
      content = {
        note: text(body['note']),
        songs: songs.map((s) => ({ title: text(s['title']), artist: text(s['artist']), url: text(s['url']) })),
      };
      break;
    }
    case 'Slides': {
      const slides = list(body['slides']);
      atMost('slides', slides, 60, 'slides');
      if (!Object.keys(errors).length)
        slides.forEach((s, i) => {
          const id = s['resourceId'];
          if (!id || !directory.file(String(id), callerId))
            add(`slides[${i}].resourceId`, 'Choose a PDF or an image.');
        });
      content = { slides: slides.map((s) => ({ resourceId: s['resourceId'] ? String(s['resourceId']) : null })) };
      break;
    }
  }
  return Object.keys(errors).length ? { errors } : { content };
}

/** Ready with at least one item (L2-172 AC5). */
export function optionalReady(kind: OptionalHubSectionKind, c: Content): boolean {
  switch (kind) {
    case 'Parking':
      return list(c['options']).length > 0;
    case 'WhatToBring':
      return strings(c['bring']).length > 0 || list(c['onTheDay']).length > 0;
    case 'Partners':
      return strings(c['partnerIds']).length > 0;
    case 'Tracks':
      return list(c['tracks']).length > 0;
    case 'Process':
      return list(c['stages']).length > 0;
    case 'Rules':
      return list(c['rules']).length > 0;
    case 'DemoFormat':
      return list(c['segments']).length > 0;
    case 'Judging':
      return list(c['criteria']).length > 0 || list(c['honors']).length > 0;
    case 'Worship':
      return list(c['songs']).length > 0;
    case 'Slides':
      return list(c['slides']).length > 0;
  }
}

/** The kind's content as the API reads it: defaults filled; partners, maps and slides read live. */
export function optionalContent(kind: OptionalHubSectionKind, c: Content, directory: HackathonDirectory): Content {
  switch (kind) {
    case 'Parking':
      return {
        note: c['note'] ?? null,
        options: list(c['options']).map((o) => {
          const map = o['mapResourceId'] ? directory.file(String(o['mapResourceId']), null) : undefined;
          return {
            title: o['title'] ?? null,
            notes: o['notes'] ?? null,
            mapResourceId: map?.kind === 'Image' ? map.id : null,
            mapTitle: map?.kind === 'Image' ? map.title : null,
          };
        }),
      };
    case 'WhatToBring':
      return { bring: strings(c['bring']), onTheDay: list(c['onTheDay']) };
    case 'Partners':
      return {
        partners: strings(c['partnerIds'])
          .map((id) => directory.partner(String(id)))
          .filter((p) => !!p),
        meet: c['meet'] ?? null,
      };
    case 'Tracks':
      return { tracks: list(c['tracks']), goodLooksLike: list(c['goodLooksLike']) };
    case 'Process':
      return { name: c['name'] ?? null, intro: c['intro'] ?? null, stages: list(c['stages']) };
    case 'Rules':
      return { rules: list(c['rules']), note: c['note'] ?? null };
    case 'DemoFormat':
      return {
        minutes: c['minutes'] ?? null,
        questionMinutes: c['questionMinutes'] ?? null,
        segments: list(c['segments']),
        tips: strings(c['tips']),
      };
    case 'Judging':
      return {
        topScore: c['topScore'] ?? null,
        criteria: list(c['criteria']),
        honors: list(c['honors']),
        note: c['note'] ?? null,
      };
    case 'Worship':
      return { note: c['note'] ?? null, songs: list(c['songs']) };
    case 'Slides':
      return {
        slides: list(c['slides'])
          .map((s) => (s['resourceId'] ? directory.file(String(s['resourceId']), null) : undefined))
          .filter((f): f is HubFileResource => !!f)
          .map((f) => ({ resourceId: f.id, title: f.title, kind: f.kind })),
      };
  }
}

/** The resources a section names, for the hub's file route (L2-182 AC3). */
export function resourceIds(kind: string, c: Content): string[] {
  if (kind === 'Parking')
    return list(c['options']).flatMap((o) => (o['mapResourceId'] ? [String(o['mapResourceId'])] : []));
  if (kind === 'Slides')
    return list(c['slides']).flatMap((s) => (s['resourceId'] ? [String(s['resourceId'])] : []));
  return [];
}
