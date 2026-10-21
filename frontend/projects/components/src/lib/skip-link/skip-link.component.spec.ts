import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SkipLinkComponent } from './skip-link.component';

@Component({
  imports: [SkipLinkComponent],
  template: `<ft-skip-link />
    <main id="main" tabindex="-1">Main</main>`,
})
class HostComponent {}

@Component({ imports: [SkipLinkComponent], template: `<ft-skip-link>Jump</ft-skip-link>` })
class CustomLabelComponent {}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  const a = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
  return { fixture, a, main: fixture.nativeElement.querySelector('main') as HTMLElement };
}

describe('SkipLinkComponent', () => {
  it('is a native link to the main landmark labelled "Skip to content"', () => {
    const { a } = setup();
    expect(a.getAttribute('href')).toBe('#main');
    expect(a.textContent?.trim()).toBe('Skip to content');
    expect(a.hasAttribute('aria-label')).toBe(false);
  });

  it('allows the label to be replaced by projected content', () => {
    const f = TestBed.createComponent(CustomLabelComponent);
    f.detectChanges();
    expect(f.nativeElement.querySelector('a').textContent.trim()).toBe('Jump');
  });

  it('moves focus to the target when activated', () => {
    const { a, main } = setup();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    a.dispatchEvent(event);
    expect(document.activeElement).toBe(main);
    expect(event.defaultPrevented).toBe(true);
  });

  it('stays in the tab order (never display:none)', () => {
    const { a } = setup();
    expect(a.tabIndex).toBe(0);
  });
});
