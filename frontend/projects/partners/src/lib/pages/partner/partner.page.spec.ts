// Traces to: L2-017, L2-018, L2-113, L2-114, L2-115
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  PARTNERS_SERVICE,
  PartnerActivityDto,
  PartnerDto,
  PartnerDuplicateDto,
} from '@faithtech-community/api';
import { DialogService, ToastService } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import {
  LogActivityDialog,
  MergePartnersDialog,
  MovePartnerDialog,
  RestorePartnerDialog,
} from '../../dialogs';
import { partnerDto } from '../../testing';
import { PartnerPage } from './partner.page';

async function setup(
  get: () => Observable<PartnerDto>,
  dialogResult?: unknown,
  items: PartnerActivityDto[] = [],
  matches: PartnerDuplicateDto[] | 'fails' = [],
) {
  let duplicates = matches === 'fails' ? [] : matches;
  const service = {
    get: vi.fn((id: string) =>
      id === 'x2' ? of(partnerDto({ id: 'x2', name: 'Kestrel Labs Inc.' })) : get(),
    ),
    activities: vi.fn(() => of({ items, before: null })),
    duplicates: vi.fn(() =>
      matches === 'fails'
        ? throwError(() => new HttpErrorResponse({ status: 500 }))
        : of({ matches: duplicates }),
    ),
    dismissDuplicate: vi.fn(() => {
      duplicates = duplicates.slice(1);
      return of(undefined);
    }),
  };
  const dialogs = { open: vi.fn(() => ({ closed: of(dialogResult) })) };
  const toasts = { show: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: PARTNERS_SERVICE, useValue: service },
      { provide: DialogService, useValue: dialogs },
      { provide: ToastService, useValue: toasts },
    ],
  });
  const fixture = TestBed.createComponent(PartnerPage);
  fixture.componentRef.setInput('id', 'x1');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  // The timeline loads its first page once the partner is shown.
  await settle();
  const host: HTMLElement = fixture.nativeElement;
  const text = () => host.textContent!.replace(/\s+/g, ' ');
  const link = (name: string) =>
    Array.from(host.querySelectorAll('a')).find((a) => a.textContent?.trim() === name);
  const button = (name: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === name);
  return { host, service, dialogs, toasts, text, link, button, settle };
}

const kestrelInc: PartnerDuplicateDto = {
  id: 'x2',
  name: 'Kestrel Labs Inc.',
  reason: 'Website',
  matchedOn: 'kestrel.example',
  addedByName: 'Esther Nakamura',
  addedOn: '2026-10-13',
};
const kestrelLtd: PartnerDuplicateDto = {
  id: 'x3',
  name: 'Kestrel Labs Ltd',
  reason: 'Name',
  matchedOn: 'Kestrel Labs Ltd',
  addedByName: null,
  addedOn: null,
};

describe('PartnerPage', () => {
  it('shows the partner’s stage, details and Edit', async () => {
    const { host, text, link } = await setup(() => of(partnerDto()));

    expect(host.querySelector('h1')!.textContent).toContain('Kestrel Labs');
    expect(host.querySelector('ft-page-header ft-badge')!.textContent).toContain('In funnel');
    const facts = Array.from(host.querySelectorAll('dl')).map(
      (dl) =>
        `${dl.querySelector('dt')!.textContent!.trim()}: ${dl.querySelector('dd')!.textContent!.trim()}`,
    );
    expect(facts).toEqual([
      'Contact: Nadia Petrov',
      'Email: nadia@kestrel.example',
      'Phone: 416-555-0199',
      'Website: kestrel.example',
      'Offering: Venue for Builders Night',
      'Owner: Grace Okonkwo',
      'Next step: Not set',
      'Notes: Studio of 12 developers.',
    ]);
    expect(link('Edit')!.getAttribute('href')).toBe('/partners/x1/edit');
    expect(link('nadia@kestrel.example')!.getAttribute('href')).toBe(
      'mailto:nadia@kestrel.example',
    );
    expect(text()).toContain('No touchpoints yet');
    expect(text()).not.toContain('Last activity');
  });

  it('shows Last activity in the header and the next step in Details', async () => {
    const { text } = await setup(() =>
      of(
        partnerDto({
          lastActivityOn: '2026-10-21',
          nextStep: 'Send credit-line wording',
          nextStepDue: '2026-10-22',
        }),
      ),
    );

    expect(text()).toContain('Venue for Builders Night · Last activity Wed 21 Oct');
    expect(text()).toContain('Send credit-line wording · Thu 22 Oct');
  });

  it('lists the timeline with each entry’s type, who and when', async () => {
    const { host } = await setup(() => of(partnerDto()), undefined, [
      {
        id: 'a1',
        kind: 'StageMoved',
        summary: 'Proposal sent.',
        text: 'Moved Kestrel Labs from Lead to In funnel: “Proposal sent.”',
        occurredOn: '2026-10-14',
        occurredAt: '12:00:00',
        nextStep: null,
        nextStepDue: null,
        loggedById: 'p1',
        loggedByName: 'Grace Okonkwo',
        loggedAtUtc: '2026-10-14T12:00:00Z',
        fromStage: 'Lead',
        toStage: 'InFunnel',
        relatedPartnerId: null,
        relatedPartnerName: null,
        mergedFromPartnerId: null,
        mergedFromPartnerName: null,
      },
    ]);

    const entry = host.querySelector('ft-feed-item')!.textContent!.replace(/\s+/g, ' ');
    expect(entry).toContain('Stage moved · Grace Okonkwo');
    expect(entry).toContain('Moved Kestrel Labs from Lead to In funnel: “Proposal sent.”');
    expect(entry).toContain('Wed 14 Oct, 12:00 pm');
  });

  it('hides Log activity for Staff', async () => {
    const { host } = await setup(() => of(partnerDto({ canEdit: false, canLogActivity: false })));

    const buttons = Array.from(host.querySelectorAll('button')).map((b) => b.textContent!.trim());
    expect(buttons).not.toContain('Log activity');
  });

  it('hides Edit for Staff', async () => {
    const { link } = await setup(() => of(partnerDto({ canEdit: false })));

    expect(link('Edit')).toBeUndefined();
  });

  it('says when the partner is missing', async () => {
    const { text } = await setup(() => throwError(() => new HttpErrorResponse({ status: 404 })));

    expect(text()).toContain('We couldn’t find that partner');
  });

  it('moves the partner from its page, shows the new stage and reloads the timeline', async () => {
    const moved = partnerDto({ stage: 'Confirmed' });
    const { host, dialogs, service, settle } = await setup(() => of(partnerDto()), moved);

    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Move stage')!
      .click();
    await settle();

    expect(dialogs.open).toHaveBeenCalledWith(MovePartnerDialog, {
      data: { partnerId: 'x1', name: 'Kestrel Labs', stage: 'InFunnel' },
    });
    expect(host.querySelector('ft-page-header ft-badge')!.textContent).toContain('Confirmed');
    expect(service.activities).toHaveBeenCalledTimes(2);
  });

  it('says which details were not added', async () => {
    const { host } = await setup(() => of(partnerDto({ phone: null, website: null })));

    const values = Array.from(host.querySelectorAll('dd')).map((d) => d.textContent!.trim());
    expect([values[2], values[3]]).toEqual(['Not added', 'Not added']);
  });

  it('logs an activity, confirms it and reloads the timeline', async () => {
    const logged = { id: 'a1', kind: 'Call' };
    const { host, service, dialogs, toasts, settle } = await setup(() => of(partnerDto()), logged);
    expect(service.activities).toHaveBeenCalledTimes(1);

    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Log activity')!
      .click();
    await settle();

    expect(dialogs.open).toHaveBeenCalledWith(LogActivityDialog, {
      data: { partnerId: 'x1', name: 'Kestrel Labs' },
    });
    expect(toasts.show).toHaveBeenCalledWith({
      variant: 'success',
      heading: 'Call logged for Kestrel Labs',
    });
    expect(service.activities).toHaveBeenCalledTimes(2);
  });

  it('warns about the first possible duplicate with who added it, when and why', async () => {
    const { host, text, link, button } = await setup(
      () => of(partnerDto()),
      undefined,
      [],
      [kestrelInc, kestrelLtd],
    );

    const alert = host.querySelector('ft-alert')!;
    expect(alert.querySelector('[role="status"]')).toBeTruthy();
    expect(text()).toContain('This may be the same partner as “Kestrel Labs Inc.” and 1 more');
    expect(text()).toContain(
      'Esther Nakamura added Kestrel Labs Inc. on Tue 13 Oct with the same website, kestrel.example.',
    );
    expect(text()).toContain('Merging keeps one record and moves both activity timelines into it.');
    expect(link('Open Kestrel Labs Inc.')!.getAttribute('href')).toBe('/partners/x2');
    expect(button('Not the same')).toBeTruthy();
  });

  it('names a name match without the added line when the match has no Added entry', async () => {
    const { text } = await setup(() => of(partnerDto()), undefined, [], [kestrelLtd]);

    expect(text()).toContain('This may be the same partner as “Kestrel Labs Ltd”');
    expect(text()).not.toContain('and 1 more');
    expect(text()).not.toContain(' added ');
  });

  it('shows Staff the alert without Not the same', async () => {
    const { host, button } = await setup(
      () => of(partnerDto({ canEdit: false, canLogActivity: false })),
      undefined,
      [],
      [kestrelInc],
    );

    expect(host.querySelector('ft-alert')).toBeTruthy();
    expect(button('Not the same')).toBeUndefined();
  });

  it('shows no alert without a possible duplicate', async () => {
    const { host } = await setup(() => of(partnerDto()));

    expect(host.querySelector('ft-alert')).toBeNull();
  });

  it('marks a pair as not the same, then the next match takes the alert', async () => {
    const { service, toasts, text, button, settle } = await setup(
      () => of(partnerDto()),
      undefined,
      [],
      [kestrelInc, kestrelLtd],
    );

    button('Not the same')!.click();
    await settle();
    await settle();

    expect(service.dismissDuplicate).toHaveBeenCalledWith('x1', 'x2');
    expect(toasts.show).toHaveBeenCalledWith({
      variant: 'success',
      heading: 'Marked Kestrel Labs Inc. as a different partner',
    });
    expect(text()).toContain('This may be the same partner as “Kestrel Labs Ltd”');
    expect(document.activeElement?.tagName).toBe('H1');
  });

  it('keeps the page without the alert when the duplicate check fails', async () => {
    const { host, text } = await setup(() => of(partnerDto()), undefined, [], 'fails');

    expect(host.querySelector('ft-alert')).toBeNull();
    expect(text()).toContain('Venue for Builders Night');
  });

  it('opens Compare and merge with both partners and lands on the merged partner', async () => {
    const merged = partnerDto({ phone: '416-555-0100', version: 2 });
    const { service, dialogs, toasts, text, button, settle } = await setup(
      () => of(partnerDto()),
      merged,
      [],
      [kestrelInc],
    );
    expect(service.activities).toHaveBeenCalledTimes(1);

    button('Compare and merge')!.click();
    await settle();
    await settle();

    expect(service.get).toHaveBeenCalledWith('x2');
    expect(dialogs.open).toHaveBeenCalledWith(MergePartnersDialog, {
      data: {
        kept: partnerDto(),
        other: partnerDto({ id: 'x2', name: 'Kestrel Labs Inc.' }),
        match: kestrelInc,
      },
    });
    expect(toasts.show).toHaveBeenCalledWith({
      variant: 'success',
      heading: 'Merged Kestrel Labs Inc. into Kestrel Labs',
      text: 'Both timelines are here now. A System Admin can restore Kestrel Labs Inc.',
    });
    expect(text()).toContain('416-555-0100');
    expect(service.activities).toHaveBeenCalledTimes(2);
    expect(service.duplicates).toHaveBeenCalledTimes(2);
  });

  it('shows Staff no Compare and merge', async () => {
    const { button } = await setup(
      () => of(partnerDto({ canEdit: false, canLogActivity: false })),
      undefined,
      [],
      [kestrelInc],
    );

    expect(button('Compare and merge')).toBeUndefined();
  });

  it('says who merged an archived partner, when and into which one, read-only', async () => {
    const archived = partnerDto({
      id: 'x1',
      name: 'Kestrel Labs Inc.',
      canEdit: false,
      canLogActivity: false,
      archived: {
        mergedIntoId: 'x9',
        mergedIntoName: 'Kestrel Labs',
        mergedIntoVersion: 4,
        mergedById: 'p1',
        mergedByName: 'Grace Okonkwo',
        mergedAtUtc: '2026-10-21T19:02:44Z',
      },
    });
    const { host, service, text, link, button } = await setup(() => of(archived));

    expect(text()).toContain('Kestrel Labs Inc. was merged into Kestrel Labs');
    expect(text()).toContain(
      'Grace Okonkwo merged it on Wed 21 Oct. Its activity and stage history are on Kestrel Labs.',
    );
    expect(link('Open Kestrel Labs')!.getAttribute('href')).toBe('/partners/x9');
    expect(host.querySelector('ft-page-header ft-badge')!.textContent).toContain('Archived');
    expect(button('Log activity')).toBeUndefined();
    expect(button('Move stage')).toBeUndefined();
    expect(link('Edit')).toBeUndefined();
    expect(button('Restore')).toBeUndefined();
    expect(service.duplicates).not.toHaveBeenCalled();
    expect(service.activities).not.toHaveBeenCalled();
    expect(text()).toContain('This record’s entries moved to Kestrel Labs when it was merged.');
  });

  it('lets a System Admin restore an archived partner', async () => {
    const archived = partnerDto({
      name: 'Kestrel Labs Inc.',
      canEdit: false,
      canLogActivity: false,
      canRestore: true,
      archived: {
        mergedIntoId: 'x9',
        mergedIntoName: 'Kestrel Labs',
        mergedIntoVersion: 4,
        mergedById: 'p1',
        mergedByName: 'Grace Okonkwo',
        mergedAtUtc: '2026-10-21T19:02:44Z',
      },
    });
    const restored = partnerDto({ name: 'Kestrel Labs Inc.', stage: 'Lead' });
    const { dialogs, toasts, text, button, settle, service } = await setup(
      () => of(archived),
      restored,
    );

    button('Restore')!.click();
    await settle();
    await settle();

    expect(dialogs.open).toHaveBeenCalledWith(RestorePartnerDialog, {
      data: { partner: archived },
    });
    expect(toasts.show).toHaveBeenCalledWith({
      variant: 'success',
      heading: 'Kestrel Labs Inc. restored',
      text: 'It’s back on the board at Lead with its own entries.',
    });
    expect(text()).not.toContain('was merged into');
    expect(service.activities).toHaveBeenCalledTimes(1);
    expect(service.duplicates).toHaveBeenCalledTimes(1);
  });
});
