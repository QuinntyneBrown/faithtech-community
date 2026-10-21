import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TabBarComponent, TabBarItem } from './tab-bar.component';

const ITEMS: TabBarItem[] = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'Events', href: '/events', icon: 'events', current: true },
  { label: 'Search', href: '/search', icon: 'search' },
];

@Component({
  imports: [TabBarComponent],
  template: `<ft-tab-bar
    [items]="items()"
    [label]="label()"
    [moreLabel]="moreLabel()"
    [moreCurrent]="moreCurrent()"
    (more)="opened = opened + 1"
  />`,
})
class HostComponent {
  items = signal(ITEMS);
  label = signal('Primary, phone');
  moreLabel = signal<string | null>(null);
  moreCurrent = signal(false);
  opened = 0;
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  return { fixture, host, cmp: fixture.componentInstance };
}

describe('TabBarComponent', () => {
  it('renders a labelled nav of links', () => {
    const { host } = setup();
    expect(host.querySelector('nav')?.getAttribute('aria-label')).toBe('Primary, phone');
    const links = host.querySelectorAll('nav a');
    expect(links.length).toBe(3);
    expect(links[0].getAttribute('href')).toBe('/');
    expect(links[0].textContent).toContain('Home');
  });

  it('marks only the current item with aria-current', () => {
    const { host } = setup();
    const links = host.querySelectorAll('nav a');
    expect(links[1].getAttribute('aria-current')).toBe('page');
    expect(links[0].getAttribute('aria-current')).toBeNull();
  });

  it('shows no current item when none is current', () => {
    const { fixture, cmp, host } = setup();
    cmp.items.set(ITEMS.map((i) => ({ ...i, current: false })));
    fixture.detectChanges();
    expect(host.querySelector('[aria-current]')).toBeNull();
  });

  it('renders decorative icons', () => {
    const { host } = setup();
    expect(host.querySelectorAll('nav a ft-icon').length).toBe(3);
    expect(host.querySelector('nav a svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('has no More button unless it is labelled', () => {
    const { host } = setup();
    expect(host.querySelector('nav button')).toBeNull();
  });

  it('ends with a More button that asks to open the menu', () => {
    const { fixture, cmp, host } = setup();
    cmp.moreLabel.set('More');
    fixture.detectChanges();
    const more = host.querySelector('nav > :last-child') as HTMLButtonElement;
    expect(more.tagName).toBe('BUTTON');
    expect(more.textContent).toContain('More');
    expect(more.getAttribute('aria-haspopup')).toBe('dialog');
    more.click();
    expect(cmp.opened).toBe(1);
  });

  it('marks More current when the page is outside the other tabs', () => {
    const { fixture, cmp, host } = setup();
    cmp.items.set(ITEMS.map((i) => ({ ...i, current: false })));
    cmp.moreLabel.set('More');
    cmp.moreCurrent.set(true);
    fixture.detectChanges();
    expect(host.querySelector('nav button')?.getAttribute('aria-current')).toBe('true');
  });
});
