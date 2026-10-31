// Traces to: L2-055, L2-057, L2-066, L2-146 AC4
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  AUTH_SERVICE,
  ORGANISATION_SERVICE,
  PagedResult,
  RESOURCES_SERVICE,
  ResourceSummary,
  Capability,
} from '@faithtech-community/api';
import { ApplicationRef, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';

import { ResourcesPage } from './resources.page';

function row(overrides: Partial<ResourceSummary> = {}): ResourceSummary {
  return {
    id: 'r1',
    title: 'City launch deck',
    type: 'deck',
    typeName: 'Deck',
    fileName: 'city-launch-deck.pptx',
    extension: 'pptx',
    size: 1024,
    linkUrl: null,
    linkHost: null,
    ownerId: 'p1',
    ownerName: 'Grace Okonkwo',
    isOwn: false,
    visibility: 'Global',
    sharedWithYou: false,
    hasThumbnail: false,
    isStored: true,
    addedAt: '2026-10-20T12:00:00Z',
    ...overrides,
  };
}

function page(items: ResourceSummary[]): PagedResult<ResourceSummary> {
  return { items, page: 1, pageSize: 25, totalCount: items.length };
}

const TYPES = [
  { id: 't1', key: 'deck', name: 'Deck' },
  { id: 't2', key: 'logo', name: 'Logo' },
  { id: 't7', key: 'other', name: 'Other' },
];

async function setup(
  capabilities: Capability[],
  list: () => Observable<PagedResult<ResourceSummary>>,
  archivedResourceTypes = [{ id: 't5', key: 'template', name: 'Template' }],
) {
  const service = { list: vi.fn(list), tags: vi.fn(() => of([])), thumbnail: vi.fn() };
  const organisation = { get: () => of({ resourceTypes: TYPES, archivedResourceTypes }) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: RESOURCES_SERVICE, useValue: service },
      { provide: ORGANISATION_SERVICE, useValue: organisation },
      { provide: AUTH_SERVICE, useValue: { capabilities: signal(capabilities) } },
    ],
  });
  const fixture = TestBed.createComponent(ResourcesPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { host: fixture.nativeElement as HTMLElement, service };
}

describe('ResourcesPage', () => {
  it('lists what the member may open under Recently added with its count', async () => {
    const { host } = await setup(['JoinWorkspaces'], () =>
      of(
        page([row(), row({ id: 'r2', title: 'Logo', visibility: 'Shared', sharedWithYou: true })]),
      ),
    );

    expect(host.querySelector('h1')!.textContent).toContain('Resources');
    expect(host.textContent).toContain('Decks, logos, training and templates · 2 resources');
    expect(host.textContent).toContain('Recently added');
    expect(host.textContent).toContain('Shared with you');
    expect(
      host.querySelector('[aria-label="Download City launch deck, PPTX, 1 KB"]'),
    ).not.toBeNull();
  });

  it('offers the organisation’s active types, and its archived ones on Show archived types', async () => {
    const { host, service } = await setup(['JoinWorkspaces'], () => of(page([row()])));
    const chips = () =>
      [...host.querySelectorAll('ft-chip-group[label="Type"] button')].map((b) =>
        b.textContent!.trim(),
      );

    expect(chips()).toEqual(['All types', 'Deck', 'Logo', 'Other', 'Show archived types']);
    (
      [...host.querySelectorAll('button')].find(
        (b) => b.textContent!.trim() === 'Show archived types',
      ) as HTMLButtonElement
    ).click();
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    expect(chips()).toEqual([
      'All types',
      'Deck',
      'Logo',
      'Other',
      'Template',
      'Show archived types',
    ]);

    (
      [...host.querySelectorAll('button')].find(
        (b) => b.textContent!.trim() === 'Template',
      ) as HTMLButtonElement
    ).click();
    await Promise.resolve();
    expect(service.list).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'template' }));
  });

  it('offers no Show archived types while no type is archived', async () => {
    const { host } = await setup(['JoinWorkspaces'], () => of(page([row()])), []);

    expect(host.textContent).not.toContain('Show archived types');
  });

  it('offers no Add resource or Archived to a member who may not add', async () => {
    const { host } = await setup(['JoinWorkspaces'], () => of(page([row()])));
    expect(host.textContent).not.toContain('Add resource');
    expect(host.querySelector('a[href="/resources/archived"]')).toBeNull();
  });

  it('offers Add resource and Archived to a holder of AddResources, as Staff are', async () => {
    const { host } = await setup(['AddResources', 'ViewReports'], () => of(page([row()])));
    expect(host.textContent).toContain('Add resource');
    expect(host.querySelector('a[href="/resources/archived"]')).not.toBeNull();
  });

  it('shows the empty state with Add the first resource for a contributor', async () => {
    const { host } = await setup(['AddResources'], () => of(page([])));
    expect(host.textContent).toContain('· none yet');
    expect(host.textContent).toContain('No resources yet');
    expect(host.textContent).toContain('Add the first resource');
  });

  it('offers Try again when the list fails to load', async () => {
    const { host } = await setup([], () => throwError(() => new Error('offline')));
    expect(host.textContent).toContain('We couldn’t load resources');
    expect(host.textContent).toContain('Try again');
  });
});
