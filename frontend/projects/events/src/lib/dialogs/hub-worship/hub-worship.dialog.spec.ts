// Traces to: L2-181 AC1, L2-172 AC3 (docs/detailed-designs/events/build-hackathon-hub)
import { HttpErrorResponse } from '@angular/common/http';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { EVENT_HUBS_SERVICE, EventHubDto, WorshipContent } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { HubWorshipDialog } from './hub-worship.dialog';

function hub(content: WorshipContent): EventHubDto {
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
    sections: [{ kind: 'Worship', visible: true, state: 'NeedsInfo', content }],
    organisation: {
      name: 'FaithTech Community',
      shortName: 'FaithTech',
      givingLink: null,
      givingText: null,
    },
    upcomingEvents: [],
  };
}

function setup(
  content: WorshipContent = { note: null, songs: [] },
  answer?: () => Observable<void>,
) {
  const ref = { close: vi.fn() };
  const saveSection = vi.fn<() => Observable<void>>(answer ?? (() => of(undefined)));
  TestBed.configureTestingModule({
    providers: [
      { provide: EVENT_HUBS_SERVICE, useValue: { saveSection } },
      { provide: DialogRef, useValue: ref },
      { provide: DIALOG_DATA, useValue: { hub: hub(content) } },
    ],
  });
  const fixture = TestBed.createComponent(HubWorshipDialog);
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
      .find((b) => b.textContent?.trim() === name || b.getAttribute('aria-label') === name)!
      .click();
    await settle();
  };
  const field = (row: string, label: string) => {
    const group = Array.from(host.querySelectorAll('[role="group"]')).find(
      (g) => g.querySelector('h4')?.textContent?.trim() === row,
    )!;
    const labelEl = Array.from(group.querySelectorAll('label')).find((l) =>
      l.textContent?.trim().startsWith(label),
    )!;
    return host.querySelector<HTMLInputElement>(`#${labelEl.getAttribute('for')}`)!;
  };
  const fill = async (row: string, label: string, value: string) => {
    const input = field(row, label);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  return { host, ref, saveSection, click, field, fill, settle };
}

describe('HubWorshipDialog', () => {
  it('asks what you will sing and says when there are no songs yet', () => {
    const { host } = setup();
    expect(host.querySelector('h3')?.textContent?.trim()).toBe('What will you sing?');
    expect(host.textContent).toContain('No songs yet.');
  });

  it('adds a song and saves the note and the songs', async () => {
    const { ref, saveSection, click, fill } = setup();
    await click('Add a song');
    await fill('Song 01', 'Song', ' Build My Life ');
    await fill('Song 01', 'Artist', 'Housefires');
    await fill('Song 01', 'Listen link', 'https://example.org/song');
    await click('Save');

    expect(saveSection).toHaveBeenCalledWith('e1', 'Worship', {
      note: null,
      songs: [{ title: 'Build My Life', artist: 'Housefires', url: 'https://example.org/song' }],
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('opens with the saved songs and saves them in their new order', async () => {
    const { saveSection, click, field } = setup({
      note: 'Three songs.',
      songs: [
        { title: 'Holy Forever', artist: 'Chris Tomlin', url: null },
        { title: 'Make Room', artist: null, url: null },
      ],
    });
    expect(field('Song 02', 'Song').value).toBe('Make Room');
    await click('Move Make Room up');
    await click('Save');

    expect(saveSection).toHaveBeenCalledWith('e1', 'Worship', {
      note: 'Three songs.',
      songs: [
        { title: 'Make Room', artist: null, url: null },
        { title: 'Holy Forever', artist: 'Chris Tomlin', url: null },
      ],
    });
  });

  it('shows the server’s message on the song’s link and stays open', async () => {
    const refused = new HttpErrorResponse({
      status: 400,
      error: { errors: { 'Songs[0].Url': ['Use a link that starts with https://'] } },
    });
    const { host, ref, click, fill } = setup(undefined, () => throwError(() => refused));
    await click('Add a song');
    await fill('Song 01', 'Song', 'Build My Life');
    await fill('Song 01', 'Listen link', 'http://example.org/song');
    await click('Save');

    expect(host.textContent).toContain('Use a link that starts with https://');
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('moves focus to the Add button once the last song is removed', async () => {
    const { host, click } = setup({
      note: null,
      songs: [{ title: 'Make Room', artist: null, url: null }],
    });
    await click('Remove Make Room');

    expect(host.textContent).toContain('No songs yet.');
    expect(document.activeElement?.textContent?.trim()).toBe('Add a song');
  });
});
