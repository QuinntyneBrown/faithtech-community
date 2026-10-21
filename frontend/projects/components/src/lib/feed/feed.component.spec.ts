import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FeedComponent } from './feed.component';
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
