// Traces to: L2-175 AC1 (docs/detailed-designs/events/build-hackathon-hub)
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  EVENT_HUBS_SERVICE,
  EventHubDto,
  PARTNERS_SERVICE,
  PartnerBoardDto,
  PartnersContent,
} from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { HubPartnersDialog } from './hub-partners.dialog';

function hubWith(content: PartnersContent | null): EventHubDto {
  return {
    id: 'h1',
    eventId: 'e1',
    status: 'Draft',
    publishedAt: null,
    templateKey: 'hackathon',
    link: 'https://app.faithtech.community/public/events/e1/hub',
    event: {
      title: 'SoCal Hackathon',
      startsAt: '2026-10-24T16:00:00.000Z',
      endsAt: '2026-10-25T01:00:00.000Z',
      format: 'InPerson',
      venue: null,
      onlineLink: null,
      rsvpLink: 'https://app.faithtech.community/public/events/e1',
      isCancelled: false,
    },
    sections: [{ kind: 'Partners', visible: true, state: 'Ready', content }],
    organisation: {
      name: 'FaithTech Community',
      shortName: 'FaithTech',
      givingLink: null,
      givingText: null,
    },
    upcomingEvents: [],
  } as EventHubDto;
}

const card = (id: string, name: string, offering: string | null) => ({
  id,
  name,
  offering,
  contactName: null,
  nextStep: null,
  nextStepDue: null,
});

const board = (...names: [string, string, string | null][]): PartnerBoardDto =>
  ({
    canEdit: true,
    columns: [
      { stage: 'Lead', name: 'Lead', cards: names.slice(0, 1).map((n) => card(...n)) },
      { stage: 'Confirmed', name: 'Confirmed', cards: names.slice(1).map((n) => card(...n)) },
    ],
  }) as unknown as PartnerBoardDto;

const PARTNERS = board(
  ['p1', 'Baptize The World', 'A global movement uniting churches in baptism.'],
  ['p2', 'Harbour Coffee Co.', 'Coffee for the day.'],
  ['p3', 'Kestrel Labs', null],
);

function setup(options: {
  content?: PartnersContent | null;
  getBoard?: () => Observable<PartnerBoardDto>;
  saveSection?: () => Observable<void>;
}) {
  const ref = { close: vi.fn() };
  const saveSection = vi.fn(options.saveSection ?? (() => of(undefined)));
  const getBoard = vi.fn(options.getBoard ?? (() => of(PARTNERS)));
  TestBed.configureTestingModule({
    providers: [
      { provide: EVENT_HUBS_SERVICE, useValue: { saveSection } },
      { provide: PARTNERS_SERVICE, useValue: { getBoard } },
      { provide: DialogRef, useValue: ref },
      { provide: DIALOG_DATA, useValue: { hub: hubWith(options.content ?? null) } },
    ],
  });
  const fixture = TestBed.createComponent(HubPartnersDialog);
  const host = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };
  const click = async (name: string) => {
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.trim() === name)!
      .click();
    await settle();
  };
  const boxes = () => Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  const names = () => boxes().map((b) => b.closest('label')?.textContent ?? '');
  const tick = async (name: string) => {
    boxes()
      .find((b) => b.closest('label')?.textContent?.includes(name))!
      .click();
    await settle();
  };
  const type = async (selector: string, value: string) => {
    const input = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const status = () => host.querySelector('[role="status"]')?.textContent?.trim();
  return { host, ref, saveSection, getBoard, settle, click, boxes, names, tick, type, status };
}

describe('HubPartnersDialog', () => {
  it('lists every partner on the board with what they offer', async () => {
    const { host, settle, boxes, status } = setup({});
    await settle();
    expect(host.querySelector('h3')?.textContent?.trim()).toBe(
      'Which partners are you building with?',
    );
    expect(boxes().length).toBe(3);
    expect(host.textContent).toContain('Coffee for the day.');
    expect(status()).toBe('0 of 6 picked. You can pick up to 6 partners.');
  });

  it('filters by name and keeps a ticked partner that the search hides', async () => {
    const { ref, saveSection, settle, names, tick, type, click, status } = setup({});
    await settle();
    await type('input[type="search"]', 'bapt');
    await new Promise((resolve) => setTimeout(resolve, 300));
    await settle();
    expect(names()).toEqual([expect.stringContaining('Baptize The World')]);

    await tick('Baptize The World');
    expect(status()).toBe('1 of 6 picked. You can pick up to 6 partners.');
    await type('input[type="search"]', 'coffee');
    await new Promise((resolve) => setTimeout(resolve, 300));
    await settle();
    await tick('Harbour Coffee');
    await type('textarea', 'A global movement.');
    await click('Save');

    expect(saveSection).toHaveBeenCalledWith('e1', 'Partners', {
      partnerIds: ['p1', 'p2'],
      meet: 'A global movement.',
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('opens with the partners and paragraph the hub already holds', async () => {
    const { host, settle, boxes } = setup({
      content: {
        partners: [{ id: 'p2', name: 'Harbour Coffee Co.', offering: null, website: null }],
        meet: 'Coffee all day.',
      },
    });
    await settle();
    expect(boxes().filter((b) => b.checked).length).toBe(1);
    expect(host.querySelector('textarea')?.value).toBe('Coffee all day.');
  });

  it('says where to add partners when there are none', async () => {
    const { host, settle, boxes } = setup({ getBoard: () => of(board()) });
    await settle();
    expect(host.textContent).toContain('There are no partners yet. Add them in Partners.');
    expect(boxes().length).toBe(0);
  });

  it('offers Try again when the partners don’t load', async () => {
    let fail = true;
    const { host, settle, click, getBoard, boxes } = setup({
      getBoard: () => (fail ? throwError(() => new Error('offline')) : of(PARTNERS)),
    });
    await settle();
    expect(host.textContent).toContain('We couldn’t load your partners');
    fail = false;
    await click('Try again');
    expect(getBoard).toHaveBeenCalledTimes(2);
    expect(boxes().length).toBe(3);
  });

  it('shows the server’s refusal under the partners', async () => {
    const { host, settle, tick, click } = setup({
      saveSection: () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: { errors: { PartnerIds: ['You can pick up to 6 partners.'] } },
            }),
        ),
    });
    await settle();
    await tick('Kestrel Labs');
    await click('Save');
    expect(host.querySelector('ft-checkbox-group')?.textContent).toContain(
      'You can pick up to 6 partners.',
    );
  });
});
