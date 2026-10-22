// Traces to: L2-026
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SEARCH_SERVICE, SearchResultsDto } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

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
        },
      ],
    },
    {
      kind: 'Contact',
      items: [
        {
          id: 'c1',
          title: 'Tomás Ortega',
          snippet: 'Harbour Light Shelter',
          route: '/contacts/c1',
        },
      ],
    },
    {
      kind: 'WorkItem',
      items: [
        {
          id: 'w1',
          title: 'Shelter problem briefs',
          snippet: 'Story · Toronto team · In Progress',
          route: '/workspaces/ws/items/w1',
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
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: SEARCH_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(SearchPage);
  if (q !== undefined) fixture.componentRef.setInput('q', q);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const input = () => host.querySelector<HTMLInputElement>('input[type="search"]')!;
  const button = (label: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const link = (label: string) =>
    Array.from(host.querySelectorAll('a')).find((a) => a.textContent?.trim() === label);
  return { fixture, host, service, settle, input, button, link, router: TestBed.inject(Router) };
}

describe('SearchPage', () => {
  it('invites a search before anything is typed and runs none', async () => {
    const { host, service, input } = await setup(undefined, () => of(RESULTS));

    expect(host.querySelector('h1')!.textContent).toContain('Search');
    expect(host.querySelector('form[role="search"]')).not.toBeNull();
    expect(input().getAttribute('aria-label')).toBe('Search');
    expect(host.textContent).toContain('Search all of FaithTech');
    expect(service.search).not.toHaveBeenCalled();
  });

  it('shows a hint and runs no search for a term under 2 characters', async () => {
    const { host, service } = await setup('s', () => of(RESULTS));

    expect(service.search).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Type at least 2 characters to search.');
  });

  it('groups the results the server allows, with links to each item', async () => {
    const { host, service, input, link } = await setup('shelter', () => of(RESULTS));

    expect(service.search).toHaveBeenCalledWith('shelter');
    expect(input().value).toBe('shelter');
    expect(host.textContent).toContain('3 results for “shelter”');
    const headings = Array.from(host.querySelectorAll('h2')).map((h) => h.textContent!.trim());
    expect(headings).toEqual([
      'People (1)',
      'Your private contacts (1)',
      'Work items in your workspaces (1)',
    ]);
    expect(link('Ruth Alvarez')!.getAttribute('href')).toBe('/people/p1');
    expect(link('Shelter problem briefs')!.getAttribute('href')).toBe('/workspaces/ws/items/w1');
    expect(host.textContent).toContain('Private');
  });

  it('suggests other terms when nothing matches', async () => {
    const { host, link } = await setup('zebra crossing', () => of({ groups: [] }));

    expect(host.textContent).toContain('No results for “zebra crossing”');
    expect(host.textContent).toContain('Check the spelling, try fewer words');
    expect(link('Clear search')!.getAttribute('href')).toBe('/search');
  });

  it('offers Try again when search fails', async () => {
    let fail = true;
    const { host, button, settle, service } = await setup('shelter', () =>
      fail ? throwError(() => new Error('offline')) : of(RESULTS),
    );
    expect(host.textContent).toContain('We couldn’t load search results');

    fail = false;
    button('Try again')!.click();
    await settle();

    expect(service.search).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('3 results for “shelter”');
  });

  it('puts the term in the address when searching, so the page can be shared', async () => {
    const { input, host, router, settle } = await setup(undefined, () => of(RESULTS));
    const navigate = vi.spyOn(router, 'navigate');

    input().value = ' shelter ';
    input().dispatchEvent(new Event('input'));
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    expect(navigate).toHaveBeenCalledWith(['/search'], { queryParams: { q: 'shelter' } });
  });
});
