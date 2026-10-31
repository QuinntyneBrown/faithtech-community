import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MenuComponent, MenuEntry } from './menu.component';

const ENTRIES: MenuEntry[] = [
  { kind: 'header', title: 'Grace Okonkwo', caption: 'City Lead · Toronto' },
  { kind: 'divider' },
  { kind: 'item', id: 'profile', label: 'Your profile', icon: 'team', href: '/profile' },
  { kind: 'item', id: 'settings', label: 'Settings', icon: 'settings' },
  { kind: 'divider' },
  { kind: 'item', id: 'sign-out', label: 'Sign out', icon: 'sign-out' },
];

@Component({
  imports: [MenuComponent],
  template: `<ft-menu
    label="Account menu for Grace Okonkwo"
    [entries]="entries()"
    (itemSelected)="selected.push($event)"
    ><span>GO</span></ft-menu
  >`,
})
class HostComponent {
  entries = signal(ENTRIES);
  selected: string[] = [];
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const trigger = host.querySelector('button') as HTMLButtonElement;
  const open = () => {
    trigger.click();
    fixture.detectChanges();
    return document.querySelector('[role="menu"]') as HTMLElement | null;
  };
  return { fixture, host, trigger, open };
}

describe('MenuComponent', () => {
  it('renders a named menu-button trigger with projected content', () => {
    const { trigger } = setup();
    expect(trigger.textContent).toContain('GO');
    expect(trigger.getAttribute('aria-label')).toBe('Account menu for Grace Okonkwo');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a labelled role=menu with menuitems, a header and dividers', () => {
    const { trigger, open } = setup();
    const menu = open()!;
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(menu.getAttribute('aria-label')).toBe('Account menu for Grace Okonkwo');
    expect(
      [...menu.querySelectorAll('[role="menuitem"]')].map((e) => e.textContent?.trim()),
    ).toEqual(['Your profile', 'Settings', 'Sign out']);
    expect(menu.querySelector('a[role="menuitem"]')?.getAttribute('href')).toBe('/profile');
    expect(menu.textContent).toContain('City Lead · Toronto');
    expect(menu.querySelectorAll('.menu__divider[aria-hidden="true"]').length).toBe(2);
  });

  it('renders a group: a header the items are described by, and items with a caption line', () => {
    const { fixture, open } = setup();
    fixture.componentInstance.entries.set([
      { kind: 'header', id: 'switch-org-h', title: 'Switch organisation' },
      {
        kind: 'item',
        id: 'org:northside',
        label: 'Northside Makers',
        caption: 'community.northside.test',
        icon: 'switch',
        href: 'https://community.northside.test/auth/continue?returnUrl=/',
        describedBy: 'switch-org-h',
      },
    ]);
    fixture.detectChanges();
    const menu = open()!;

    const item = menu.querySelector('a[role="menuitem"]')!;
    expect(menu.querySelector('#switch-org-h')?.textContent).toContain('Switch organisation');
    expect(item.getAttribute('aria-describedby')).toBe('switch-org-h');
    expect(item.querySelector('.menu__item-caption')?.textContent).toBe('community.northside.test');
    expect(item.textContent).toContain('Northside Makers');
  });

  it('emits the item id and closes when an item is chosen', () => {
    const { fixture, open } = setup();
    const menu = open()!;
    (menu.querySelectorAll('[role="menuitem"]')[1] as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected).toEqual(['settings']);
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it('closes on Escape', () => {
    const { fixture, open } = setup();
    const menu = open()!;
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    fixture.detectChanges();
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
});
