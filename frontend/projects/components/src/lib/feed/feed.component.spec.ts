import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FeedComponent, FeedState } from './feed.component';
import { FeedItemComponent } from './feed-item.component';

@Component({
  imports: [FeedComponent, FeedItemComponent],
  template: `<ft-feed label="Recent activity">
    <ft-feed-item actor="Marcus Lee" color="sun" meta="Yesterday, 4:10 pm"
      >Marcus Lee published <a href="/e/1">Builders Night</a></ft-feed-item
    >
    <ft-feed-item actor="Ruth Alvarez">Accepted</ft-feed-item>
  </ft-feed>`,
})
class HostComponent {}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('FeedComponent', () => {
  it('is a labelled list of items', () => {
    const el = setup();
    const feed = el.querySelector('ft-feed') as HTMLElement;
    expect(feed.getAttribute('role')).toBe('list');
    expect(feed.getAttribute('aria-label')).toBe('Recent activity');
    expect(el.querySelectorAll('ft-feed-item[role="listitem"]').length).toBe(2);
  });
});

describe('FeedItemComponent', () => {
  it('shows a decorative avatar for the actor', () => {
    const el = setup();
    const avatar = el.querySelector('ft-feed-item ft-avatar') as HTMLElement;
    expect(avatar.textContent?.trim()).toBe('ML');
    expect(avatar.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('projects rich body content and shows the meta line', () => {
    const el = setup();
    const item = el.querySelector('ft-feed-item') as HTMLElement;
    expect(item.querySelector('.ft-feed-item__body a')?.getAttribute('href')).toBe('/e/1');
    expect(item.querySelector('.ft-feed-item__meta')?.textContent).toBe('Yesterday, 4:10 pm');
  });

  it('omits meta when none is given', () => {
    const el = setup();
    expect(el.querySelectorAll('ft-feed-item')[1].querySelector('.ft-feed-item__meta')).toBeNull();
  });
});

@Component({
  imports: [FeedComponent, FeedItemComponent],
  template: `<ft-feed
    label="Recent activity"
    [state]="state()"
    [retrying]="retrying()"
    (retry)="retried = retried + 1"
  >
    <ft-feed-item actor="Marcus Lee">Marcus Lee published Builders Night</ft-feed-item>
  </ft-feed>`,
})
class StateHostComponent {
  readonly state = signal<FeedState>('ready');
  readonly retrying = signal(false);
  retried = 0;
}

function setupState(state: FeedState) {
  const fixture = TestBed.createComponent(StateHostComponent);
  fixture.componentInstance.state.set(state);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const feed = el.querySelector('ft-feed') as HTMLElement;
  return { fixture, cmp: fixture.componentInstance, feed };
}

describe('FeedComponent states', () => {
  // Given the feed is loading, then it is a busy, labelled list of skeleton rows and no items.
  it('loading: a busy list of skeleton rows in place of the items', () => {
    const { feed } = setupState('loading');
    expect(feed.getAttribute('role')).toBe('list');
    expect(feed.getAttribute('aria-busy')).toBe('true');
    expect(feed.getAttribute('aria-label')).toBe('Loading recent activity');
    const rows = feed.querySelectorAll('.ft-feed__skeleton-row');
    expect(rows.length).toBe(3);
    rows.forEach((row) => expect(row.querySelector('.ft-skeleton--avatar')).not.toBeNull());
    expect(feed.querySelector('ft-feed-item')).toBeNull();
  });

  // Given there is no activity, then the card keeps its heading and says so in plain text.
  it('empty: plain text instead of a list', () => {
    const { feed } = setupState('empty');
    expect(feed.getAttribute('role')).toBeNull();
    expect(feed.getAttribute('aria-busy')).toBeNull();
    expect(feed.querySelector('.ft-feed__empty')?.textContent).toContain('No activity yet');
    expect(feed.querySelector('ft-feed-item')).toBeNull();
  });

  // Given the feed failed to load, then a danger alert offers a Try again button that retries.
  it('error: a danger alert with a Try again button that emits retry', () => {
    const { feed, cmp } = setupState('error');
    expect(feed.getAttribute('role')).toBeNull();
    expect(feed.querySelector('[role="alert"]')?.textContent).toContain(
      'We couldn’t load recent activity',
    );
    const button = feed.querySelector('ft-alert button') as HTMLButtonElement;
    expect(button.textContent).toContain('Try again');
    button.click();
    expect(cmp.retried).toBe(1);
    expect(feed.querySelector('ft-feed-item')).toBeNull();
  });

  it('error: does not retry again while retrying', () => {
    const { fixture, feed, cmp } = setupState('error');
    cmp.retrying.set(true);
    fixture.detectChanges();
    const button = feed.querySelector('ft-alert button') as HTMLButtonElement;
    expect(button.getAttribute('aria-busy')).toBe('true');
    button.click();
    expect(cmp.retried).toBe(0);
  });

  it('ready: shows the projected items', () => {
    const { feed } = setupState('ready');
    expect(feed.getAttribute('aria-busy')).toBeNull();
    expect(feed.querySelectorAll('ft-feed-item').length).toBe(1);
  });
});
