import { CdkMenu } from '@angular/cdk/menu';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MenuItemComponent } from './menu-item.component';

@Component({
  imports: [CdkMenu, MenuItemComponent],
  template: `
    <div cdkMenu>
      <button ft-menu-item icon="settings" type="button">Settings</button>
      <a ft-menu-item icon="sign-out" href="/sign-out">Sign out</a>
      <button ft-menu-item type="button" disabled>Admin</button>
    </div>
  `,
})
class HostComponent {}

describe('MenuItemComponent', () => {
  function items() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[ft-menu-item]'),
    );
  }

  it('renders an icon and label on native button and link hosts', () => {
    const [button, link] = items();
    expect(button.textContent).toContain('Settings');
    expect(button.querySelector('ft-icon svg')).not.toBeNull();
    expect(link.textContent).toContain('Sign out');
    expect(link.getAttribute('href')).toBe('/sign-out');
  });

  it('is a menuitem and keeps aria-disabled', () => {
    const all = items();
    expect(all.every((i) => i.getAttribute('role') === 'menuitem')).toBe(true);
    expect(all[2].getAttribute('aria-disabled')).toBe('true');
  });
});
