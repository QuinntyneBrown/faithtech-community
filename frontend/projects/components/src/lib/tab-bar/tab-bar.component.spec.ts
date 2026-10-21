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
  template: `<ft-tab-bar [items]="items()" [label]="label()" />`,
})
class HostComponent {
  items = signal(ITEMS);
  label = signal('Primary, phone');
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
});
