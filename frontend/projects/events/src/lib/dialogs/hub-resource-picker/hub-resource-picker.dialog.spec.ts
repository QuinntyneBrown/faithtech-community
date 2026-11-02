// Traces to: L2-173 AC1, L2-182 AC1 (docs/detailed-designs/events/build-hackathon-hub)
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { PagedResult, RESOURCES_SERVICE, ResourceSummary } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import {
  HubResourcePickerData,
  HubResourcePickerDialog,
  hubFileKind,
} from './hub-resource-picker.dialog';

const resource = (id: string, title: string, extension: string | null): ResourceSummary =>
  ({
    id,
    title,
    extension,
    hasThumbnail: false,
    ownerName: 'Grace Okonkwo',
    addedAt: '2026-10-20T16:00:00.000Z',
  }) as ResourceSummary;

const ALL = [
  resource('r1', 'Parking map', 'jpg'),
  resource('r2', 'Hackathon slides', 'pdf'),
  resource('r3', 'Budget', 'xlsx'),
  resource('r4', 'Welcome slide', 'PNG'),
];

function setup(
  data: HubResourcePickerData,
  list: (q: { q?: string; page?: number }) => Observable<PagedResult<ResourceSummary>> = () =>
    of({ items: ALL, page: 1, pageSize: 25, totalCount: ALL.length }),
) {
  const ref = { close: vi.fn() };
  const listSpy = vi.fn(list);
  TestBed.configureTestingModule({
    providers: [
      { provide: RESOURCES_SERVICE, useValue: { list: listSpy, thumbnail: vi.fn() } },
      { provide: DialogRef, useValue: ref },
      { provide: DIALOG_DATA, useValue: data },
    ],
  });
  const fixture = TestBed.createComponent(HubResourcePickerDialog);
  const host = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };
  const options = () =>
    Array.from(
      host.querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]'),
    );
  const titles = () =>
    Array.from(host.querySelectorAll('.ft-picker-row__title')).map((t) => t.textContent?.trim());
  const tick = async (title: string) => {
    options()
      .find((o) => o.closest('label')?.textContent?.includes(title))!
      .click();
    await settle();
  };
  const click = async (name: string) => {
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.trim() === name)!
      .click();
    await settle();
  };
  return { host, ref, listSpy, settle, options, titles, tick, click };
}

describe('hubFileKind', () => {
  it('reads images and PDFs, whatever the case, and nothing else', () => {
    expect(hubFileKind('JPEG')).toBe('Image');
    expect(hubFileKind('webp')).toBe('Image');
    expect(hubFileKind('pdf')).toBe('Pdf');
    expect(hubFileKind('docx')).toBeNull();
    expect(hubFileKind(null)).toBeNull();
  });
});

describe('HubResourcePickerDialog', () => {
  it('offers only images for a map, as radios, and says what to pick', async () => {
    const { host, settle, titles, options } = setup({ accept: 'image', multiple: false });
    await settle();
    expect(titles()).toEqual(['Parking map', 'Welcome slide']);
    expect(options().every((o) => o.type === 'radio')).toBe(true);
    expect(host.textContent).toContain('Pick an image for the map.');
  });

  it('offers images and PDFs for slides and returns them in the order ticked', async () => {
    const { host, ref, settle, titles, tick, click } = setup({ accept: 'slides', multiple: true });
    await settle();
    expect(titles()).toEqual(['Parking map', 'Hackathon slides', 'Welcome slide']);
    expect(host.textContent).toContain(
      'Pick a PDF or images. They’re added in the order you tick them.',
    );

    await tick('Welcome slide');
    await tick('Hackathon slides');
    await click('Choose');

    expect(ref.close).toHaveBeenCalledWith([
      { id: 'r4', title: 'Welcome slide', kind: 'Image' },
      { id: 'r2', title: 'Hackathon slides', kind: 'Pdf' },
    ]);
  });

  it('keeps one map when another is picked', async () => {
    const { ref, settle, tick, click } = setup({ accept: 'image', multiple: false });
    await settle();
    await tick('Parking map');
    await tick('Welcome slide');
    await click('Choose');
    expect(ref.close).toHaveBeenCalledWith([{ id: 'r4', title: 'Welcome slide', kind: 'Image' }]);
  });

  it('reads every page of Resources', async () => {
    const { settle, titles, listSpy } = setup({ accept: 'image', multiple: false }, (q) =>
      of(
        q.page === 2
          ? { items: [ALL[3]], page: 2, pageSize: 3, totalCount: 4 }
          : { items: ALL.slice(0, 3), page: 1, pageSize: 3, totalCount: 4 },
      ),
    );
    await settle();
    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(titles()).toEqual(['Parking map', 'Welcome slide']);
  });

  it('says when there are no images', async () => {
    const { host, settle } = setup({ accept: 'image', multiple: false }, () =>
      of({ items: [ALL[2]], page: 1, pageSize: 25, totalCount: 1 }),
    );
    await settle();
    expect(host.textContent).toContain('No images in Resources yet.');
  });

  it('offers Try again when Resources don’t load', async () => {
    let fail = true;
    const { host, settle, click, titles } = setup({ accept: 'image', multiple: false }, () =>
      fail
        ? throwError(() => new Error('offline'))
        : of({ items: ALL, page: 1, pageSize: 25, totalCount: ALL.length }),
    );
    await settle();
    expect(host.textContent).toContain('We couldn’t load Resources');
    fail = false;
    await click('Try again');
    expect(titles()).toEqual(['Parking map', 'Welcome slide']);
  });
});
