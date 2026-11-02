// Traces to: L2-173 AC1; L2-172 AC3 (docs/detailed-designs/events/build-hackathon-hub)
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  EVENT_HUBS_SERVICE,
  EventHubDto,
  ParkingContent,
  RESOURCES_SERVICE,
  ResourceDto,
  ResourceUploadEvent,
} from '@faithtech-community/api';
import { DialogService } from '@faithtech-community/components';
import { Observable, Subject, of, throwError } from 'rxjs';

import { HubResourceChoice } from '../hub-resource-picker';
import { HubParkingDialog } from './hub-parking.dialog';

function hubWith(content: ParkingContent | null): EventHubDto {
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
    sections: [{ kind: 'Parking', visible: true, state: 'Ready', content }],
    organisation: {
      name: 'FaithTech Community',
      shortName: 'FaithTech',
      givingLink: null,
      givingText: null,
    },
    upcomingEvents: [],
  } as EventHubDto;
}

function setup(
  options: {
    content?: ParkingContent | null;
    picked?: HubResourceChoice[];
    upload?: () => Observable<ResourceUploadEvent>;
    saveSection?: () => Observable<void>;
  } = {},
) {
  const ref = { close: vi.fn() };
  const saveSection = vi.fn(options.saveSection ?? (() => of(undefined)));
  const upload = vi.fn(options.upload ?? (() => new Subject<ResourceUploadEvent>()));
  const thumbnail = vi.fn(() => throwError(() => new Error('none')));
  const open = vi.fn(() => ({ closed: of(options.picked) }));
  TestBed.configureTestingModule({
    providers: [
      { provide: EVENT_HUBS_SERVICE, useValue: { saveSection } },
      { provide: RESOURCES_SERVICE, useValue: { upload, thumbnail } },
      { provide: DialogService, useValue: { open } },
      { provide: DialogRef, useValue: ref },
      { provide: DIALOG_DATA, useValue: { hub: hubWith(options.content ?? null) } },
    ],
  });
  const fixture = TestBed.createComponent(HubParkingDialog);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };
  const click = async (name: string, scope: HTMLElement = host) => {
    Array.from(scope.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name)!
      .click();
    await settle();
  };
  const row = (heading: string) =>
    Array.from(host.querySelectorAll<HTMLElement>('ft-repeat-row')).find(
      (r) => r.querySelector('h4')?.textContent?.trim() === heading,
    )!;
  const fill = async (scope: HTMLElement, label: string, value: string) => {
    const l = Array.from(scope.querySelectorAll('label')).find((x) =>
      x.textContent?.trim().startsWith(label),
    )!;
    const input = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${l.htmlFor}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const choose = async (scope: HTMLElement, ...files: File[]) => {
    const input = scope.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change'));
    await settle();
  };
  const question = () => host.querySelector('h3')?.textContent?.trim();
  return { host, ref, saveSection, upload, open, settle, click, row, fill, choose, question };
}

const file = (name: string) => new File(['x'], name);

describe('HubParkingDialog', () => {
  it('asks what people should know first, then lists the options', async () => {
    const { host, click, question, saveSection, fill } = setup();
    expect(question()).toBe('What should people know first?');
    expect(host.textContent).toContain('Shown at the top of Parking');
    await fill(host, 'Note', 'Park on site first.');

    await click('Next');
    expect(saveSection).toHaveBeenCalledWith('e1', 'Parking', {
      note: 'Park on site first.',
      options: [],
    });
    expect(question()).toBe('Parking options');
    expect(host.textContent).toContain('No parking options yet.');
  });

  it('gives an option a map from Resources and saves it', async () => {
    const { host, ref, saveSection, open, click, row, fill, question } = setup({
      picked: [{ id: 'r1', title: 'SoCal parking, on site', kind: 'Image' }],
    });
    await click('Next');
    await click('Add an option');
    await fill(row('Option 01'), 'Name', 'On site');
    await click('Choose from Resources', row('Option 01'));

    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: { accept: 'image', multiple: false } }),
    );
    expect(row('Option 01').textContent).toContain('SoCal parking, on site');
    expect(host.textContent).toContain('1 of 6 options. You can add up to 6 options.');

    await click('Save');
    expect(saveSection).toHaveBeenLastCalledWith('e1', 'Parking', {
      note: null,
      options: [{ title: 'On site', notes: null, mapResourceId: 'r1' }],
    });
    expect(ref.close).toHaveBeenCalledWith(true);
    expect(question()).toBe('Parking options');
  });

  it('removes a map from an option', async () => {
    const { saveSection, click, row } = setup({
      content: {
        note: null,
        options: [{ title: 'On site', notes: null, mapResourceId: 'r1', mapTitle: 'Lot A' }],
      },
    });
    await click('Next');
    expect(row('Option 01').textContent).toContain('Lot A');
    await click('Remove map from option 1', row('Option 01'));
    expect(row('Option 01').textContent).not.toContain('Lot A');
    await click('Save');
    expect(saveSection).toHaveBeenLastCalledWith('e1', 'Parking', {
      note: null,
      options: [{ title: 'On site', notes: null, mapResourceId: null }],
    });
  });

  it('asks for an image when another kind of file is chosen, uploading nothing', async () => {
    const { upload, click, row, choose } = setup();
    await click('Next');
    await click('Add an option');
    await choose(row('Option 01'), file('lots.pdf'));
    expect(row('Option 01').textContent).toContain('Choose an image.');
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads a map to Resources and uses it once done', async () => {
    const events = new Subject<ResourceUploadEvent>();
    const { upload, click, row, choose, settle } = setup({ upload: () => events });
    await click('Next');
    await click('Add an option');
    await choose(row('Option 01'), file('garages.jpg'));

    expect(upload).toHaveBeenCalledWith(expect.any(File), {
      tags: [],
      visibility: 'Global',
      memberIds: [],
      roles: [],
    });
    events.next({ kind: 'progress', percent: 64 });
    await settle();
    expect(
      row('Option 01').querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow'),
    ).toBe('64');

    events.next({ kind: 'done', resource: { id: 'r7', title: 'garages' } as ResourceDto });
    events.complete();
    await settle();
    expect(row('Option 01').textContent).toContain('garages');
    expect(row('Option 01').querySelector('[role="progressbar"]')).toBeNull();
  });

  it('shows the server’s message on the option’s name', async () => {
    const { click, row, settle } = setup({
      content: {
        note: null,
        options: [{ title: '', notes: null, mapResourceId: null, mapTitle: null }],
      },
      saveSection: () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: { errors: { 'Options[0].Title': ['Name this option.'] } },
            }),
        ),
    });
    await click('Next');
    await settle();
    expect(row('Option 01').textContent).toContain('Name this option.');
  });
});
