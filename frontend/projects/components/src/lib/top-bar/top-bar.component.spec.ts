import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TopBarComponent, TopBarLink } from './top-bar.component';

const LINKS: TopBarLink[] = [
  { label: 'Home', href: '/', current: true },
  { label: 'Events', href: '/events' },
  { label: 'Team', href: '/team', secondary: true },
];

@Component({
  imports: [TopBarComponent],
  template: `<ft-top-bar
    [links]="links()"
    [anonymous]="anonymous()"
    [moreLabel]="moreLabel()"
    (searchSubmit)="searched = $event"
    (more)="opened = opened + 1"
    ><span ftTopBarActions class="slot">actions</span></ft-top-bar
  >`,
})
class HostComponent {
  links = signal(LINKS);
  anonymous = signal(false);
  moreLabel = signal<string | null>(null);
  searched: string | null = null;
  opened = 0;
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const q = <T extends Element>(s: string) => host.querySelector(s) as T;
  return { fixture, host, cmp: fixture.componentInstance, q };
}

describe('TopBarComponent', () => {
  it('renders a banner landmark with the brand linking home', () => {
    const { q } = setup();
    expect(q('header')).toBeTruthy();
    const brand = q<HTMLAnchorElement>('.top-bar__brand');
    expect(brand.getAttribute('href')).toBe('/');
    expect(brand.textContent).toContain('FaithTech');
  });

  it('renders a labelled primary nav with aria-current on the current link', () => {
    const { host, q } = setup();
    expect(q('nav').getAttribute('aria-label')).toBe('Primary');
    const links = host.querySelectorAll('nav a');
    expect(links.length).toBe(3);
    expect(links[0].getAttribute('aria-current')).toBe('page');
    expect(links[1].getAttribute('aria-current')).toBeNull();
  });

  it('marks secondary links so they can hide on narrower screens', () => {
    const { host } = setup();
    expect(host.querySelectorAll('nav a')[2].classList).toContain('top-bar__link--secondary');
  });

  it('has a labelled search landmark that emits the query on submit', () => {
    const { fixture, cmp, q } = setup();
    expect(q('form').getAttribute('role')).toBe('search');
    const input = q<HTMLInputElement>('input[type=search]');
    expect(q<HTMLLabelElement>('label').textContent).toContain('Search FaithTech');
    expect(q<HTMLLabelElement>('label').htmlFor).toBe(input.id);
    input.value = 'toronto';
    q<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(cmp.searched).toBe('toronto');
  });

  it('composes the shared small text field for search', () => {
    const { q } = setup();
    const input = q<HTMLInputElement>('ft-text-field input[type=search]');
    expect(input.classList).toContain('input--sm');
    expect(input.name).toBe('q');
    expect(input.placeholder).toBe('Search people, events, partners');
  });

  it('projects the actions slot', () => {
    expect(setup().q('.slot')).toBeTruthy();
  });

  it('shows only the brand and actions when anonymous', () => {
    const { fixture, cmp, q } = setup();
    cmp.anonymous.set(true);
    fixture.detectChanges();
    expect(q('nav')).toBeNull();
    expect(q('form')).toBeNull();
    expect(q('.slot')).toBeTruthy();
  });

  it('has no More button unless it is labelled', () => {
    const { q } = setup();
    expect(q('nav button')).toBeNull();
  });

  it('ends the nav with a More button that asks to open the menu', () => {
    const { fixture, cmp, q } = setup();
    cmp.moreLabel.set('More');
    fixture.detectChanges();
    const more = q<HTMLButtonElement>('nav > :last-child');
    expect(more.tagName).toBe('BUTTON');
    expect(more.textContent?.trim()).toBe('More');
    expect(more.getAttribute('aria-haspopup')).toBe('dialog');
    expect(more.classList).toContain('top-bar__more');
    more.click();
    expect(cmp.opened).toBe(1);
  });
});
