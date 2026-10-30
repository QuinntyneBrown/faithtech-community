// Traces to: L2-017, L2-018
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { PARTNERS_SERVICE, PartnerBoardDto } from '@faithtech-community/api';
import { BreakpointService, DialogService, ToastService } from '@faithtech-community/components';
import { signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';

import { AddPartnerDialog, MovePartnerDialog } from '../../dialogs';
import { partnerDto } from '../../testing';
import { PartnersPage } from './partners.page';

const board: PartnerBoardDto = {
  canEdit: true,
  columns: [
    {
      stage: 'Lead',
      count: 1,
      cards: [
        {
          id: 'x2',
          name: 'Maple Street Church',
          contactName: 'Kwame Asante',
          offering: 'Venue for spring builders night',
          nextStep: 'Send credit-line wording',
          nextStepDue: '2026-10-22',
        },
      ],
    },
    {
      stage: 'InFunnel',
      count: 1,
      cards: [
        {
          id: 'x1',
          name: 'Kestrel Labs',
          contactName: null,
          offering: 'Hosting Builders Night',
          nextStep: null,
          nextStepDue: null,
        },
      ],
    },
    { stage: 'Confirmed', count: 0, cards: [] },
  ],
};

async function setupBoard(
  getBoard: () => Observable<PartnerBoardDto>,
  options: { dialogResult?: unknown; breakpoint?: string; move?: () => Observable<unknown> } = {},
) {
  const service = {
    getBoard: vi.fn(getBoard),
    move: vi.fn(options.move ?? (() => of(partnerDto()))),
  };
  const dialogs = { open: vi.fn(() => ({ closed: of(options.dialogResult) })) };
  const toasts = { show: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: PARTNERS_SERVICE, useValue: service },
      { provide: DialogService, useValue: dialogs },
      { provide: ToastService, useValue: toasts },
      { provide: BreakpointService, useValue: { current: signal(options.breakpoint ?? 'lg') } },
    ],
  });
  const fixture = TestBed.createComponent(PartnersPage);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host: HTMLElement = fixture.nativeElement;
  const text = () => host.textContent!.replace(/\s+/g, ' ');
  const columns = () =>
    Array.from(host.querySelectorAll('ft-kanban-column:not([hidden])')).map(
      (c) =>
        `${c.querySelector('h2')!.textContent!.trim()} ${c.querySelector('ft-badge')!.textContent!.trim()}: ${Array.from(
          c.querySelectorAll('ft-kanban-card a'),
        )
          .map((a) => a.textContent!.trim())
          .join(', ')}`,
    );
  const button = (label: string) =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label,
    );
  return { host, service, dialogs, toasts, text, columns, button, settle, fixture };
}

describe('PartnersPage', () => {
  it('shows the pipeline in three columns with counts', async () => {
    const { host, text, columns } = await setupBoard(() => of(board));

    expect(host.querySelector('h1')!.textContent).toContain('Partners');
    expect(text()).toContain('Shared by every lead · 2 partners');
    expect(columns()).toEqual([
      'Lead 1: Maple Street Church',
      'In funnel 1: Kestrel Labs',
      'Confirmed 0: ',
    ]);
    expect(host.querySelector('ft-kanban-card a')!.getAttribute('href')).toBe('/partners/x2');
    expect(host.querySelector('ft-kanban-card')!.textContent).toContain(
      'Kwame Asante · Venue for spring builders night',
    );
    const cards = host.querySelectorAll('ft-kanban-card');
    expect(cards[0].textContent).toContain('Next: Send credit-line wording · Thu 22 Oct');
    expect(cards[1].textContent).not.toContain('Next:');
  });

  it('adds a partner through the dialog and puts it in its stage', async () => {
    const created = partnerDto({
      id: 'x9',
      name: 'Lantern Foundation',
      stage: 'Confirmed',
      contactName: null,
      offering: null,
    });
    const { dialogs, button, columns, settle } = await setupBoard(
      () => of(structuredClone(board)),
      {
        dialogResult: created,
      },
    );

    button('Add partner')!.click();
    await settle();

    expect(dialogs.open).toHaveBeenCalledWith(AddPartnerDialog, {});
    expect(columns()[2]).toBe('Confirmed 1: Lantern Foundation');
  });

  it('shows Staff the board read-only', async () => {
    const { text, button, host } = await setupBoard(() => of({ ...board, canEdit: false }));

    expect(text()).toContain('Read-only for Staff');
    expect(button('Add partner')).toBeUndefined();
    expect(host.querySelector('ft-kanban-card button')).toBeNull();
  });

  it('invites a lead to start the pipeline when it is empty', async () => {
    const { text } = await setupBoard(() =>
      of({ canEdit: true, columns: board.columns.map((c) => ({ ...c, count: 0, cards: [] })) }),
    );

    expect(text()).toContain('Start your partner pipeline');
  });

  it('explains the pipeline is for leads when the caller may not see it', async () => {
    const { text } = await setupBoard(() =>
      throwError(() => new HttpErrorResponse({ status: 403 })),
    );

    expect(text()).toContain('The partner pipeline is for leads');
  });

  it('offers a retry when the board cannot load', async () => {
    const { text } = await setupBoard(() =>
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    expect(text()).toContain('We couldn’t load the partner pipeline');
  });

  it('moves a partner with the Move dialog and announces it', async () => {
    const moved = partnerDto({ id: 'x2', name: 'Maple Street Church', stage: 'Confirmed' });
    const { dialogs, button, columns, settle, host } = await setupBoard(
      () => of(structuredClone(board)),
      {
        dialogResult: moved,
      },
    );

    button('Move Maple Street Church to another stage')!.click();
    await settle();

    expect(dialogs.open).toHaveBeenCalledWith(MovePartnerDialog, {
      data: { partnerId: 'x2', name: 'Maple Street Church', stage: 'Lead' },
    });
    expect(columns()).toEqual([
      'Lead 0: ',
      'In funnel 1: Kestrel Labs',
      'Confirmed 1: Maple Street Church',
    ]);
    expect(host.querySelector('[aria-live="polite"]')!.textContent).toContain(
      'Maple Street Church moved to Confirmed',
    );
  });

  it('moves a partner dropped on another column', async () => {
    const { service, columns, settle, fixture } = await setupBoard(
      () => of(structuredClone(board)),
      {
        move: () => of(partnerDto({ id: 'x1', stage: 'Lead' })),
      },
    );

    const column = fixture.debugElement.queryAll((d) => d.name === 'ft-kanban-column')[0];
    column.componentInstance.cardDropped.emit({
      cardId: 'x1',
      from: 'InFunnel',
      to: 'Lead',
      index: 0,
    });
    await settle();

    expect(service.move).toHaveBeenCalledWith('x1', 'Lead');
    expect(columns()[0]).toBe('Lead 2: Kestrel Labs, Maple Street Church');
  });

  it('leaves the card where it was when a drop fails', async () => {
    const { columns, settle, fixture, toasts } = await setupBoard(
      () => of(structuredClone(board)),
      {
        move: () => throwError(() => new HttpErrorResponse({ status: 503 })),
      },
    );

    const column = fixture.debugElement.queryAll((d) => d.name === 'ft-kanban-column')[0];
    column.componentInstance.cardDropped.emit({
      cardId: 'x1',
      from: 'InFunnel',
      to: 'Lead',
      index: 0,
    });
    await settle();

    expect(columns()[1]).toBe('In funnel 1: Kestrel Labs');
    expect(toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'danger', heading: 'Partner not moved' }),
    );
  });

  it('shows the stages as tabs with one column at a time on a phone', async () => {
    const { host, columns, settle } = await setupBoard(() => of(board), { breakpoint: 'base' });

    const tabs = Array.from(host.querySelectorAll('[role="tab"]')).map((t) =>
      t.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(tabs).toEqual(['Lead 1', 'In funnel 1', 'Confirmed 0']);
    expect(columns()).toEqual(['Lead 1: Maple Street Church']);

    host.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
    await settle();

    expect(columns()).toEqual(['In funnel 1: Kestrel Labs']);
  });
});
