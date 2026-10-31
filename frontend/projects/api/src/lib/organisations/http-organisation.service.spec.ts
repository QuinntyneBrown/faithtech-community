import { Observable } from 'rxjs';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { HANDLES_FORBIDDEN, HANDLES_SERVER_ERROR } from '../errors';
import { apiTestProviders } from '../shared/api-test-providers';
import { HttpOrganisationService } from './http-organisation.service';
import { ORGANISATION_SERVICE, OrganisationDto } from './organisation.service';

const ORGANISATION: OrganisationDto = {
  name: 'FaithTech Community',
  shortName: 'FaithTech',
  chapterLabel: null,
  chapters: [],
  roles: [
    { id: 'r1', key: 'Volunteer', name: 'Volunteer', description: '', chapterScopable: true },
  ],
  partnerStages: [],
  eventTypes: [],
};

describe('HttpOrganisationService', () => {
  let service: HttpOrganisationService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: ORGANISATION_SERVICE, useClass: HttpOrganisationService },
      ],
    });
    service = TestBed.inject(ORGANISATION_SERVICE) as HttpOrganisationService;
    controller = TestBed.inject(HttpTestingController);
  });

  it('reads the organisation once and caches it for the session', () => {
    const answers: OrganisationDto[] = [];
    service.get().subscribe((o) => answers.push(o));
    controller.expectOne('/api/organisation').flush(ORGANISATION);
    service.get().subscribe((o) => answers.push(o));

    controller.expectNone('/api/organisation');
    expect(answers).toEqual([ORGANISATION, ORGANISATION]);
  });

  it('saves the general settings, refusals and failures reaching the caller, and reads the organisation afresh', () => {
    service.get().subscribe();
    controller.expectOne('/api/organisation').flush(ORGANISATION);

    const settings = {
      name: 'FaithTech Global',
      shortName: 'FT Global',
      chapterLabel: { singular: 'City', plural: 'Cities' },
    };
    service.update(settings).subscribe();
    const put = controller.expectOne({ method: 'PUT', url: '/api/organisation' });
    expect(put.request.body).toEqual(settings);
    expect(put.request.context.get(HANDLES_FORBIDDEN)).toBe(true);
    expect(put.request.context.get(HANDLES_SERVER_ERROR)).toBe(true);
    put.flush(null);

    const renamed: OrganisationDto[] = [];
    service.get().subscribe((o) => renamed.push(o));
    controller.expectOne('/api/organisation').flush({ ...ORGANISATION, name: 'FaithTech Global' });
    expect(renamed[0].name).toBe('FaithTech Global');
  });

  it('lists, adds, renames, reorders and archives chapters, each write reading the organisation afresh', () => {
    const chapter = { id: 'c1', name: 'Toronto', sortOrder: 0, archived: false, memberCount: 3 };
    const lists: unknown[] = [];
    service.listChapters().subscribe((l) => lists.push(l));
    service.listChapters(true).subscribe((l) => lists.push(l));
    controller.expectOne('/api/organisation/chapters').flush([chapter]);
    controller.expectOne('/api/organisation/chapters?archived=true').flush([]);
    expect(lists).toEqual([[chapter], []]);

    const writes: (() => Observable<unknown>)[] = [
      () => service.addChapter('Toronto'),
      () => service.renameChapter('c1', 'Toronto East'),
      () => service.reorderChapters(['c2', 'c1']),
      () => service.archiveChapter('c1'),
    ];
    const expected = [
      { method: 'POST', url: '/api/organisation/chapters', body: { name: 'Toronto' } },
      { method: 'PUT', url: '/api/organisation/chapters/c1', body: { name: 'Toronto East' } },
      {
        method: 'PUT',
        url: '/api/organisation/chapters/order',
        body: { chapterIds: ['c2', 'c1'] },
      },
      { method: 'POST', url: '/api/organisation/chapters/c1/archive', body: null },
    ];
    writes.forEach((write, i) => {
      service.get().subscribe();
      controller.match('/api/organisation').forEach((r) => r.flush(ORGANISATION));
      write().subscribe();
      const request = controller.expectOne({ method: expected[i].method, url: expected[i].url });
      expect(request.request.body).toEqual(expected[i].body);
      expect(request.request.context.get(HANDLES_FORBIDDEN)).toBe(true);
      expect(request.request.context.get(HANDLES_SERVER_ERROR)).toBe(true);
      request.flush(chapter);
      service.get().subscribe();
      controller.expectOne('/api/organisation').flush(ORGANISATION);
    });
  });

  it('lists, adds, renames, reorders and archives event types, each write reading the organisation afresh', () => {
    const type = {
      id: 't1',
      key: 'panel',
      name: 'Panel',
      sortOrder: 5,
      archived: false,
      archivedAtUtc: null,
      eventCount: 2,
    };
    const lists: unknown[] = [];
    service.listEventTypes().subscribe((l) => lists.push(l));
    service.listEventTypes(true).subscribe((l) => lists.push(l));
    controller.expectOne('/api/organisation/event-types').flush([type]);
    controller.expectOne('/api/organisation/event-types?archived=true').flush([]);
    expect(lists).toEqual([[type], []]);

    const writes: (() => Observable<unknown>)[] = [
      () => service.addEventType('Prayer walk'),
      () => service.renameEventType('t1', 'Panel discussion'),
      () => service.reorderEventTypes(['t2', 't1']),
      () => service.archiveEventType('t1'),
    ];
    const base = '/api/organisation/event-types';
    const expected = [
      { method: 'POST', url: base, body: { name: 'Prayer walk' } },
      { method: 'PUT', url: `${base}/t1`, body: { name: 'Panel discussion' } },
      { method: 'PUT', url: `${base}/order`, body: { ids: ['t2', 't1'] } },
      { method: 'POST', url: `${base}/t1/archive`, body: null },
    ];
    writes.forEach((write, i) => {
      service.get().subscribe();
      controller.match('/api/organisation').forEach((r) => r.flush(ORGANISATION));
      write().subscribe();
      const request = controller.expectOne({ method: expected[i].method, url: expected[i].url });
      expect(request.request.body).toEqual(expected[i].body);
      expect(request.request.context.get(HANDLES_FORBIDDEN)).toBe(true);
      request.flush(type);
      service.get().subscribe();
      controller.expectOne('/api/organisation').flush(ORGANISATION);
    });
  });

  it('lists, adds, changes, reorders and archives partner stages, each write reading the organisation afresh', () => {
    const stage = {
      id: 's1',
      key: 'lead',
      name: 'Lead',
      isInitial: true,
      kind: 'Open',
      sortOrder: 1,
      archived: false,
      archivedAtUtc: null,
      partnerCount: 4,
    };
    const lists: unknown[] = [];
    service.listPartnerStages().subscribe((l) => lists.push(l));
    service.listPartnerStages(true).subscribe((l) => lists.push(l));
    controller.expectOne('/api/organisation/partner-stages').flush([stage]);
    controller.expectOne('/api/organisation/partner-stages?archived=true').flush([]);
    expect(lists).toEqual([[stage], []]);

    const writes: (() => Observable<unknown>)[] = [
      () => service.addPartnerStage('Proposal sent'),
      () => service.updatePartnerStage('s1', { name: 'New' }),
      () => service.updatePartnerStage('s1', { kind: 'Confirmed' }),
      () => service.reorderPartnerStages(['s2', 's1']),
      () => service.archivePartnerStage('s1'),
    ];
    const base = '/api/organisation/partner-stages';
    const expected = [
      { method: 'POST', url: base, body: { name: 'Proposal sent' } },
      { method: 'PUT', url: `${base}/s1`, body: { name: 'New' } },
      { method: 'PUT', url: `${base}/s1`, body: { kind: 'Confirmed' } },
      { method: 'PUT', url: `${base}/order`, body: { ids: ['s2', 's1'] } },
      { method: 'POST', url: `${base}/s1/archive`, body: null },
    ];
    writes.forEach((write, i) => {
      service.get().subscribe();
      controller.match('/api/organisation').forEach((r) => r.flush(ORGANISATION));
      write().subscribe();
      const request = controller.expectOne({ method: expected[i].method, url: expected[i].url });
      expect(request.request.body).toEqual(expected[i].body);
      expect(request.request.context.get(HANDLES_FORBIDDEN)).toBe(true);
      request.flush(stage);
      service.get().subscribe();
      controller.expectOne('/api/organisation').flush(ORGANISATION);
    });
  });

  it('asks again after a failure', () => {
    service.get().subscribe({ error: () => undefined });
    controller
      .expectOne('/api/organisation')
      .flush(null, { status: 500, statusText: 'Server Error' });
    service.get().subscribe();

    controller.expectOne('/api/organisation').flush(ORGANISATION);
  });
});
