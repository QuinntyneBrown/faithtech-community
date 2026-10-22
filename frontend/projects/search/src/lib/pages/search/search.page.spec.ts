// Traces to: L2-026
import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SEARCH_SERVICE, SearchResultsDto } from '@faithtech-community/api';
import { Observable, Subject, of, throwError } from 'rxjs';

import { SearchPage } from './search.page';

const RESULTS: SearchResultsDto = {
  groups: [
    {
      kind: 'Person',
      items: [
        {
          id: 'p1',
          title: 'Ruth Alvarez',
          snippet: 'Volunteer · Toronto · led the shelter intake team',
          route: '/people/p1',
          startsAt: null,
          badge: null,
        },
      ],
    },
    {
      kind: 'Event',
      items: [
        {
          id: 'e1',
          title: 'Hackathon: Tech for Shelters',
          snippet: 'Toronto · Trinity Community Centre',
          route: '/events/e1',
          startsAt: '2026-11-14T15:00:00Z',
          badge: 'Public',
        },
      ],
    },
    {
      kind: 'Partner',
      items: [
        {
          id: 'pa1',
          title: 'Lantern Foundation',
          snippet: 'Nadia Petrov · funds shelter technology',
          route: '/partners/pa1',
          startsAt: null,
          badge: 'InFunnel',
        },
      ],
    },
    {
      kind: 'Contact',
      items: [
        {
          id: 'c1',
          title: 'Tomás Ortega',
          snippet: 'Harbour Light Shelter · Toronto',
          route: '/contacts/c1',
          startsAt: null,
          badge: 'Private',
        },
      ],
    },
    {
      kind: 'WorkItem',
      items: [
        {
          id: 'w1',
          title: 'Shelter problem briefs for teams',
          snippet: 'Story · Toronto team · InProgress',
          route: '/workspaces/ws/items/w1',
          startsAt: null,
          badge: null,
        },
      ],
    },
  ],
};

async function setup(
  q: string | undefined,
  search: (term: string) => Observable<SearchResultsDto>,
) {
  const service = { search: vi.fn(search) };
  TestBed.configureTestingModule({ providers: [{ provide: SEARCH_SERVICE, useValue: service }] });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(SearchPage);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const setQuery = async (value: string | undefined) => {
    (fixture.componentRef as ComponentRef<SearchPage>).setInput('q', value);
    await settle();
  };
  await setQuery(q);
  const host = fixture.nativeElement as HTMLElement;
  const input = () => host.querySelector<HTMLInputElement>('input[type="search"]')!;
  const headings = () => Array.from(host.querySelectorAll('h2')).map((h) => h.textContent!.trim());
  return { fixture, host, service, navigate, settle, setQuery, input, headings };
}

describe('SearchPage', () => {
  it('invites a search before anything is typed and runs none', async () => {
    const { host, service } = await setup(undefined, () => of(RESULTS));

    expect(host.querySelector('h1')!.textContent).toContain('Search');
    expect(host.querySelector('form[role="search"]')).not.toBeNull();
    expect(host.textContent).toContain('Search all of FaithTech');
    expect(service.search).not.toHaveBeenCalled();
  });

  it('groups results into people, events, partners, contacts and work items', async () => {
    const { host, service, headings, input } = await setup('shelter', () => of(RESULTS));

    expect(service.search).toHaveBeenCalledWith('shelter');
    expect(input().value).toBe('shelter');
    expect(headings()).toEqual([
      'People (1)',
      'Events (1)',
      'Partners (1)',
      'Your private contacts (1)',
      'Work items in your workspaces (1)',
    ]);
    expect(host.textContent).toContain('5 results for “shelter”');
    expect(host.querySelector('a[href="/people/p1"]')).not.toBeNull();
    expect(host.textContent).toContain('Sat 14 Nov · Toronto · Trinity Community Centre');
    expect(host.textContent).toContain('In funnel');
    expect(host.textContent).toContain('Private');
    expect(host.textContent).toContain('Story · Toronto team · In progress');
  });

  it('lists resources with their type icon and badge, and links to the Resources page', async () => {
    const { host, headings } = await setup('launch', () =>
      of({
        groups: [
          {
            kind: 'Resource',
            items: [
              {
                id: 'r1',
                title: 'Austin launch retro',
                snippet: 'Deck · KEY · Esther Nakamura · tagged launch',
                route: '/resources/r1',
                startsAt: null,
                badge: 'Shared with you',
              },
            ],
          },
        ],
      } as SearchResultsDto),
    );

    expect(headings()).toEqual(['Resources (1)']);
    expect(host.textContent).toContain('Shared with you');
    expect(host.querySelector('a[href="/resources?q=launch"]')!.textContent).toContain(
      'See all in Resources',
    );
  });

  it('suggests other terms when nothing matches', async () => {
    const { host } = await setup('zebra crossing', () => of({ groups: [] }));

    expect(host.textContent).toContain('No results for “zebra crossing”');
    expect(host.textContent).toContain('Check the spelling, try fewer words');
    expect(host.querySelector('a[href="/search"]')).not.toBeNull();
  });

  it('shows a hint and runs no search for a term under 2 characters', async () => {
    const { host, service, input } = await setup('a', () => of(RESULTS));

    expect(service.search).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Type at least 2 characters to search.');
    expect(input().getAttribute('aria-describedby')).toBeTruthy();
  });

  it('says it is searching while results load', async () => {
    const pending = new Subject<SearchResultsDto>();
    const { host } = await setup('shelter', () => pending);

    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('offers Try again when the search fails', async () => {
    let fail = true;
    const { host, settle, headings } = await setup('shelter', () =>
      fail ? throwError(() => new Error('offline')) : of(RESULTS),
    );
    expect(host.textContent).toContain('We couldn’t load search results');

    fail = false;
    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Try again'))!
      .click();
    await settle();

    expect(headings()).toContain('People (1)');
  });

  it('puts the typed term in the address when the form is submitted', async () => {
    const { host, input, navigate, settle } = await setup(undefined, () => of(RESULTS));

    input().value = '  shelter ';
    input().dispatchEvent(new Event('input'));
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    expect(navigate).toHaveBeenCalledWith(['/search'], { queryParams: { q: 'shelter' } });
  });

  it('searches again when the address changes', async () => {
    const { service, setQuery } = await setup('shelter', () => of(RESULTS));

    await setQuery('hackathon');

    expect(service.search).toHaveBeenLastCalledWith('hackathon');
  });
});
