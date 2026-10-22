import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { FormatMark, FormatToolbarComponent } from './format-toolbar.component';

@Component({
  imports: [FormatToolbarComponent],
  template: `<ft-format-toolbar
    [pressed]="{ bold: true }"
    [inLink]="inLink()"
    (format)="used.push($event)"
    (removeLink)="used.push('remove')"
  />`,
})
class HostComponent {
  readonly inLink = signal(false);
  readonly used: (FormatMark | 'remove')[] = [];
}

describe('FormatToolbarComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('ft-format-toolbar') as HTMLElement;
    const button = (name: string) =>
      el.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
    return { fixture, el, button };
  }

  it('is a toolbar named Formatting whose mark buttons expose their pressed state', () => {
    const { el, button } = setup();
    expect(el.getAttribute('role')).toBe('toolbar');
    expect(el.getAttribute('aria-label')).toBe('Formatting');
    expect(button('Bold')?.getAttribute('aria-pressed')).toBe('true');
    expect(button('Italic')?.getAttribute('aria-pressed')).toBe('false');
    expect(button('Link')?.hasAttribute('aria-pressed')).toBe(false);
  });

  it('applies a mark and offers Edit link and Remove link inside a link', () => {
    const { fixture, button } = setup();
    button('Strikethrough')!.click();
    fixture.componentInstance.inLink.set(true);
    fixture.detectChanges();
    button('Remove link')!.click();
    expect(button('Edit link')).not.toBeNull();
    expect(fixture.componentInstance.used).toEqual(['strike', 'remove']);
  });

  it('moves between buttons with the arrow keys, one tab stop for the toolbar', () => {
    const { el, button } = setup();
    expect(Array.from(el.querySelectorAll('button')).filter((b) => b.tabIndex === 0)).toHaveLength(
      1,
    );
    button('Bold')!.focus();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(document.activeElement).toBe(button('Italic'));
  });
});
