// Traces to: L2-017, L2-018
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { PARTNERS_SERVICE, PartnerDto } from '@faithtech-community/api';
import { DialogService, ToastService } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { LogActivityDialog, MovePartnerDialog } from '../../dialogs';
import { partnerDto } from '../../testing';
import { PartnerPage } from './partner.page';

async function setup(get: () => Observable<PartnerDto>, dialogResult?: unknown) {
  const service = { get: vi.fn(get), activities: vi.fn(() => of({ items: [], before: null })) };
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
  const host: HTMLElement = fixture.nativeElement;
  const text = () => host.textContent!.replace(/\s+/g, ' ');
  const link = (name: string) =>
    Array.from(host.querySelectorAll('a')).find((a) => a.textContent?.trim() === name);
  return { host, service, dialogs, toasts, text, link, settle };
}

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
      'Notes: Studio of 12 developers.',
    ]);
    expect(link('Edit')!.getAttribute('href')).toBe('/partners/x1/edit');
    expect(link('nadia@kestrel.example')!.getAttribute('href')).toBe(
      'mailto:nadia@kestrel.example',
    );
    expect(text()).toContain('No stage changes yet');
  });

  it('lists stage changes newest first with who moved it and the note', async () => {
    const { host } = await setup(() =>
      of(
        partnerDto({
          history: [
            {
              from: 'Lead',
              to: 'InFunnel',
              movedById: 'p1',
              movedByName: 'Grace Okonkwo',
              movedAtUtc: '2026-10-14T12:00:00Z',
              note: 'Proposal sent.',
            },
          ],
        }),
      ),
    );

    const entry = host.querySelector('ft-feed-item')!.textContent!.replace(/\s+/g, ' ');
    expect(entry).toContain(
      'Grace Okonkwo moved Kestrel Labs from Lead to In funnel: “Proposal sent.”',
    );
    expect(entry).toContain('Wed 14 Oct');
  });

  it('hides Edit for Staff', async () => {
    const { link } = await setup(() => of(partnerDto({ canEdit: false })));

    expect(link('Edit')).toBeUndefined();
  });

  it('says when the partner is missing', async () => {
    const { text } = await setup(() => throwError(() => new HttpErrorResponse({ status: 404 })));

    expect(text()).toContain('We couldn’t find that partner');
  });

  it('moves the partner from its page and shows the new stage and history', async () => {
    const moved = partnerDto({
      stage: 'Confirmed',
      history: [
        {
          from: 'InFunnel',
          to: 'Confirmed',
          movedById: 'p1',
          movedByName: 'Grace Okonkwo',
          movedAtUtc: '2026-10-21T12:00:00Z',
          note: null,
        },
      ],
    });
    const { host, dialogs, settle } = await setup(() => of(partnerDto()), moved);

    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Move stage')!
      .click();
    await settle();

    expect(dialogs.open).toHaveBeenCalledWith(MovePartnerDialog, {
      data: { partnerId: 'x1', name: 'Kestrel Labs', stage: 'InFunnel' },
    });
    expect(host.querySelector('ft-page-header ft-badge')!.textContent).toContain('Confirmed');
    expect(host.querySelectorAll('ft-feed-item')).toHaveLength(1);
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
});
