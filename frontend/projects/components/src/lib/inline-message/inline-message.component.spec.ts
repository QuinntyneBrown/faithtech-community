import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InlineMessageComponent } from './inline-message.component';

@Component({
  imports: [InlineMessageComponent],
  template: `<ft-inline-message>Enter a title</ft-inline-message>`,
})
class HostComponent {}

describe('InlineMessageComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('ft-inline-message') as HTMLElement;
  }

  it('renders its text with a decorative warning glyph', () => {
    const el = setup();
    expect(el.textContent).toContain('Enter a title');
    expect(el.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('is not a live region (it is linked to its field via aria-describedby)', () => {
    expect(setup().getAttribute('role')).toBeNull();
  });
});
