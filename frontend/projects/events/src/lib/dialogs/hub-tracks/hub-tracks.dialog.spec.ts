// Traces to: L2-176 AC1, L2-172 AC3, L2-157 AC2 (docs/detailed-designs/events/build-hackathon-hub)
import { HttpErrorResponse } from '@angular/common/http';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { EVENT_HUBS_SERVICE, EventHubDto, TracksContent } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { HubTracksDialog } from './hub-tracks.dialog';

function hub(content: TracksContent): EventHubDto {
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
    sections: [{ kind: 'Tracks', visible: true, state: 'NeedsInfo', content }],
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
  content: TracksContent = { tracks: [], goodLooksLike: [] },
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
  const fixture = TestBed.createComponent(HubTracksDialog);
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
  /** A field by its label, inside the row card with `row` as its heading when given. */
  const field = (label: string, row?: string) => {
    const scope = row
      ? Array.from(host.querySelectorAll('[role="group"]')).find(
          (g) => g.querySelector('h4')?.textContent?.trim() === row,
        )!
      : host;
    const labelEl = Array.from(scope.querySelectorAll('label')).find(
      (l) => l.textContent?.trim().replace(/\s+/g, ' ').split(' (')[0] === label,
    )!;
    return host.querySelector<HTMLInputElement>(`#${labelEl.getAttribute('for')}`)!;
  };
  const fill = async (label: string, value: string, row?: string) => {
    const input = field(label, row);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const radio = (name: string) =>
    Array.from(host.querySelectorAll<HTMLLabelElement>('label'))
      .find((l) => l.querySelector('input[type=radio]') && l.textContent?.trim() === name)!
      .querySelector<HTMLInputElement>('input')!;
  const question = () => host.querySelector('h3')?.textContent?.trim();
  return { host, ref, saveSection, click, field, fill, radio, settle, question };
}

const track = (title: string, primary = false) => ({
  title,
  brief: `${title} brief`,
  linkUrl: null,
  linkText: null,
  primary,
});

describe('HubTracksDialog', () => {
  it('asks which tracks teams can choose, and says when there are none yet', () => {
    const { host, question } = setup();
    expect(question()).toBe('Which tracks can teams choose?');
    expect(host.textContent).toContain('No tracks yet.');
  });

  it('saves a track marked as the primary focus, then what good looks like', async () => {
    const { ref, saveSection, click, fill, radio, settle, question } = setup();
    await click('Add a track');
    await fill('Title', 'Testimony sharing', 'Track 01');
    await fill('Brief', 'Help believers share.', 'Track 01');
    await fill('Link', 'https://example.org/brief', 'Track 01');
    expect(radio('No primary focus').checked).toBe(true);
    radio('Testimony sharing').click();
    await settle();
    await click('Next');

    expect(saveSection).toHaveBeenCalledWith('e1', 'Tracks', {
      tracks: [
        {
          title: 'Testimony sharing',
          brief: 'Help believers share.',
          linkUrl: 'https://example.org/brief',
          linkText: null,
          primary: true,
        },
      ],
      goodLooksLike: [],
    });
    expect(question()).toBe('What does good look like?');

    await click('Add a line');
    await fill('Title', 'In their language', 'Line 01');
    await click('Save');
    expect(saveSection).toHaveBeenLastCalledWith('e1', 'Tracks', {
      tracks: [expect.objectContaining({ title: 'Testimony sharing', primary: true })],
      goodLooksLike: [{ title: 'In their language', detail: null }],
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('keeps the primary focus with its track when the tracks move', async () => {
    const { saveSection, click, radio } = setup({
      tracks: [track('Onboarding'), track('Testimony sharing', true)],
      goodLooksLike: [],
    });
    expect(radio('Testimony sharing').checked).toBe(true);
    await click('Move Testimony sharing up');
    await click('Save and finish later');

    expect(saveSection).toHaveBeenCalledWith('e1', 'Tracks', {
      tracks: [track('Testimony sharing', true), track('Onboarding')],
      goodLooksLike: [],
    });
  });

  it('has no primary focus once the primary track is removed', async () => {
    const { saveSection, click, radio } = setup({
      tracks: [track('Onboarding', true), track('Testimony sharing')],
      goodLooksLike: [],
    });
    await click('Remove Onboarding');
    expect(radio('No primary focus').checked).toBe(true);
    await click('Save and finish later');

    expect(saveSection).toHaveBeenCalledWith('e1', 'Tracks', {
      tracks: [track('Testimony sharing')],
      goodLooksLike: [],
    });
  });

  it('stays on the step with the server’s message on the link', async () => {
    const refused = new HttpErrorResponse({
      status: 400,
      error: { errors: { 'Tracks[0].LinkUrl': ['Use a link that starts with https://'] } },
    });
    const { host, click, fill, question } = setup(undefined, () => throwError(() => refused));
    await click('Add a track');
    await fill('Link', 'http://example.org', 'Track 01');
    await click('Next');

    expect(question()).toBe('Which tracks can teams choose?');
    expect(host.textContent).toContain('Use a link that starts with https://');
  });
});
