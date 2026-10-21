import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthLayoutComponent } from './auth-layout.component';

@Component({
  imports: [AuthLayoutComponent],
  template: `<ft-auth-layout><h1>Welcome back</h1></ft-auth-layout>`,
})
class HostComponent {}

describe('AuthLayoutComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the page landmark the skip link targets', () => {
    const main = setup().querySelector('main');

    expect(main?.id).toBe('main');
  });

  it('starts with a skip link to the main landmark', () => {
    const el = setup();
    const first = el.querySelector('a');

    expect(first?.textContent?.trim()).toBe('Skip to content');
    expect(first?.getAttribute('href')).toBe('#main');
  });

  it('shows the logo mark above the projected card content', () => {
    const el = setup();
    const card = el.querySelector('.auth-card')!;

    expect(card.querySelector('ft-logo-mark')).not.toBeNull();
    expect(card.querySelector('h1')?.textContent).toBe('Welcome back');
  });
});
