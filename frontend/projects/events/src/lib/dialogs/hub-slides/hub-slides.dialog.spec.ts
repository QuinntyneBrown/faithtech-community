// Traces to: L2-182 AC1 (docs/detailed-designs/events/build-hackathon-hub)
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import {
  EVENT_HUBS_SERVICE,
  EventHubDto,
  RESOURCES_SERVICE,
  ResourceDto,
  ResourceUploadEvent,
  SlidesContent,
} from '@faithtech-community/api';
import { DialogService } from '@faithtech-community/components';
import { Observable, Subject, of, throwError } from 'rxjs';

import { HubResourceChoice } from '../hub-resource-picker';
import { HubSlidesDialog } from './hub-slides.dialog';

function hubWith(content: SlidesContent | null): EventHubDto {
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
    sections: [{ kind: 'Slides', visible: true, state: 'Ready', content }],
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
    content?: SlidesContent | null;
    picked?: HubResourceChoice[];
    upload?: () => Observable<ResourceUploadEvent>;
  } = {},
) {
  const ref = { close: vi.fn() };
  const saveSection = vi.fn<() => Observable<void>>(() => of(undefined));
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
  const fixture = TestBed.createComponent(HubSlidesDialog);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };
  const click = async (name: string) => {
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name)!
      .click();
    await settle();
  };
  const choose = async (...files: File[]) => {
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change'));
    await settle();
  };
  const headings = () =>
    Array.from(host.querySelectorAll('[role="group"] h4')).map((h) => h.textContent?.trim());
  const status = () => host.querySelector('p[role="status"]')?.textContent?.trim();
  return { host, ref, saveSection, upload, open, settle, click, choose, headings, status };
}

const file = (name: string) => new File(['x'], name);

describe('HubSlidesDialog', () => {
  it('asks which slides, and says there are none yet', () => {
    const { host, status } = setup();
    expect(host.querySelector('h3')?.textContent?.trim()).toBe('Which slides?');
    expect(host.textContent).toContain('No slides yet.');
    expect(status()).toBe('0 of 60 slides. You can add up to 60 slides.');
  });

  it('adds slides from Resources in the order picked, reorders them and saves', async () => {
    const { ref, saveSection, open, click, headings, status, host } = setup({
      picked: [
        { id: 'r2', title: 'SoCal Hackathon slides', kind: 'Pdf' },
        { id: 'r1', title: 'SoCal welcome slide', kind: 'Image' },
      ],
    });
    await click('Choose from Resources');
    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: { accept: 'slides', multiple: true } }),
    );
    expect(headings()).toEqual(['Slide 01', 'Slide 02']);
    expect(host.textContent).toContain('SoCal welcome slide');
    expect(status()).toBe('2 of 60 slides. You can add up to 60 slides.');

    await click('Move SoCal welcome slide up');
    await click('Save');

    expect(saveSection).toHaveBeenCalledWith('e1', 'Slides', {
      slides: [{ resourceId: 'r1' }, { resourceId: 'r2' }],
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('refuses a file that is not a PDF or an image, uploading nothing', async () => {
    const { host, upload, choose } = setup();
    await choose(file('notes.docx'));
    expect(host.textContent).toContain('Choose a PDF or an image.');
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads slides to Resources and adds each once it is done', async () => {
    const events = new Subject<ResourceUploadEvent>();
    const { host, upload, choose, headings, settle } = setup({ upload: () => events });
    await choose(file('welcome.PNG'));

    expect(upload).toHaveBeenCalledWith(expect.any(File), {
      tags: [],
      visibility: 'Global',
      memberIds: [],
      roles: [],
    });
    events.next({ kind: 'progress', percent: 40 });
    await settle();
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('40');

    events.next({
      kind: 'done',
      resource: { id: 'r9', title: 'welcome', extension: 'png' } as ResourceDto,
    });
    events.complete();
    await settle();
    expect(headings()).toEqual(['Slide 01']);
    expect(host.textContent).toContain('welcome');
  });

  it('says when an upload fails', async () => {
    const { host, choose } = setup({ upload: () => throwError(() => new Error('offline')) });
    await choose(file('deck.pdf'));
    expect(host.textContent).toContain('Didn’t upload');
  });

  it('opens with the slides the hub already holds', () => {
    const { headings, host } = setup({
      content: { slides: [{ resourceId: 'r1', title: 'Opening', kind: 'Image' }] },
    });
    expect(headings()).toEqual(['Slide 01']);
    expect(host.textContent).toContain('Opening');
  });
});
