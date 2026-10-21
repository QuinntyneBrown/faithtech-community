import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SearchGroup, SearchResultsComponent } from './search-results.component';

const GROUPS: SearchGroup[] = [
  {
    id: 'people',
    title: 'People',
    items: [
      {
        title: 'Ruth Alvarez',
        href: '/profiles/ruth-alvarez',
        meta: 'Volunteer · Toronto · led the shelter intake team',
        avatarName: 'Ruth Alvarez',
        avatarColor: 'rose',
      },
    ],
  },
  {
    id: 'events',
    title: 'Events',
    items: [
      {
        title: 'Hackathon: Tech for Shelters',
        href: '/events/h',
        meta: 'Sat 14 – Sun 15 Nov',
        badge: 'Public',
        badgeVariant: 'info',
      },
      { title: 'Shelter night', href: '/events/s' },
    ],
  },
  { id: 'partners', title: 'Partners', items: [] },
];

@Component({
  imports: [SearchResultsComponent],
  template: `<ft-search-results [query]="query()" [groups]="groups()" />`,
})
class HostComponent {
  query = signal('shelter');
  groups = signal<SearchGroup[]>(GROUPS);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const all = <T extends Element>(s: string) => Array.from(host.querySelectorAll<T>(s));
  return { fixture, cmp: fixture.componentInstance, host, all };
}

describe('SearchResultsComponent', () => {
  it('announces the result count and query in a status line', () => {
    const { host } = setup();
    expect(host.querySelector('[role="status"]')!.textContent!.trim()).toBe(
      '3 results for “shelter”',
    );
  });

  it('uses the singular for one result', () => {
    const { fixture, cmp, host } = setup();
    cmp.groups.set([GROUPS[0]]);
    fixture.detectChanges();
    expect(host.querySelector('[role="status"]')!.textContent!.trim()).toBe(
      '1 result for “shelter”',
    );
  });

  it('makes each group a section labelled by its heading with the count', () => {
    const { all } = setup();
    const sections = all('section');
    expect(sections).toHaveLength(2);
    const heading = sections[1].querySelector('h2')!;
    expect(heading.textContent!.trim()).toBe('Events (2)');
    expect(sections[1].getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('leaves out groups with no hits', () => {
    const { host } = setup();
    expect(host.textContent).not.toContain('Partners');
  });

  it('links each result title', () => {
    const { all } = setup();
    const links = all<HTMLAnchorElement>('a');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/profiles/ruth-alvarez',
      '/events/h',
      '/events/s',
    ]);
  });

  it('highlights matched words in titles and meta, case-insensitively', () => {
    const { all } = setup();
    const marks = all('mark').map((m) => m.textContent);
    expect(marks).toEqual(['shelter', 'Shelter', 'Shelter']);
  });

  it('highlights nothing and shows text as is without a query', () => {
    const { fixture, cmp, host } = setup();
    cmp.query.set('');
    fixture.detectChanges();
    expect(host.querySelector('mark')).toBeNull();
    expect(host.textContent).toContain('Hackathon: Tech for Shelters');
  });

  it('treats regular-expression characters in the query as plain text', () => {
    const { fixture, cmp, host } = setup();
    cmp.query.set('(tech');
    fixture.detectChanges();
    expect(host.querySelector('mark')).toBeNull();
  });

  it('shows an avatar (decorative) and a badge when the result has them', () => {
    const { all, host } = setup();
    const avatar = all('.ft-avatar')[0];
    expect(avatar.textContent!.trim()).toBe('RA');
    expect(avatar.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('.ft-badge--info')!.textContent!.trim()).toBe('Public');
  });

  // Given a work-item result, when it is shown, then it leads with a decorative icon tile (not a
  // planning-poker estimate card), so it reads as an object rather than a person.
  it('leads a result with a decorative icon tile when it has an icon', () => {
    const { fixture, cmp, host } = setup();
    cmp.groups.set([
      {
        id: 'work',
        title: 'Work items in your workspaces',
        items: [
          {
            title: 'Shelter problem briefs for teams',
            href: '/work-items/42',
            meta: 'Story · Toronto team · In Progress',
            icon: 'workspaces',
          },
        ],
      },
    ]);
    fixture.detectChanges();
    const tile = host.querySelector('.ft-search-group__item .ft-search-group__icon') as HTMLElement;
    expect(tile).not.toBeNull();
    expect(tile.getAttribute('aria-hidden')).toBe('true');
    expect(tile.querySelector('ft-icon')).not.toBeNull();
    expect(host.querySelector('.ft-avatar')).toBeNull();
  });
});
