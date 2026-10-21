import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavDrawerComponent, NavDrawerLink } from './nav-drawer.component';

const LINKS: NavDrawerLink[] = [
  { label: 'Home', href: '/', icon: 'home', current: true },
  { label: 'Events', href: '/events', icon: 'events' },
];

@Component({
  imports: [NavDrawerComponent],
  template: `<ft-nav-drawer
    [(open)]="open"
    [links]="links"
    (closed)="closedCount = closedCount + 1"
  />`,
})
class HostComponent {
  open = signal(false);
  links = LINKS;
  closedCount = 0;
}

async function openDrawer() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  fixture.componentInstance.open.set(true);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, cmp: fixture.componentInstance };
}
const dialog = () => document.querySelector('[role=dialog]') as HTMLElement | null;

describe('NavDrawerComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.querySelectorAll('.cdk-overlay-container').forEach((e) => (e.innerHTML = ''));
  });

  it('renders nothing while closed', () => {
    TestBed.createComponent(HostComponent).detectChanges();
    expect(dialog()).toBeNull();
  });

  it('opens a modal navigation dialog with the links', async () => {
    await openDrawer();
    const d = dialog()!;
    expect(d).toBeTruthy();
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.getAttribute('aria-label')).toBe('Main menu');
    const links = d.querySelectorAll('nav a');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('aria-current')).toBe('page');
  });

  it('closes on Escape and reports it', async () => {
    const { fixture, cmp } = await openDrawer();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(cmp.open()).toBe(false);
    expect(cmp.closedCount).toBe(1);
    expect(dialog()).toBeNull();
  });

  it('closes from the close button', async () => {
    const { fixture, cmp } = await openDrawer();
    (dialog()!.querySelector('button[aria-label="Close menu"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(cmp.open()).toBe(false);
  });

  it('closes when a link is chosen', async () => {
    const { fixture, cmp } = await openDrawer();
    const link = dialog()!.querySelectorAll('nav a')[1] as HTMLElement;
    link.addEventListener('click', (e) => e.preventDefault());
    link.click();
    fixture.detectChanges();
    expect(cmp.open()).toBe(false);
  });
});
