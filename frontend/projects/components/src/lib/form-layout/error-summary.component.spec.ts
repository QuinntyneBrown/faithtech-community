import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ErrorSummaryComponent, FormError } from './error-summary.component';

@Component({
  imports: [ErrorSummaryComponent],
  template: `<input id="t" /><input id="e" />
    <ft-error-summary [errors]="errors" (errorSelected)="picked = $event" />`,
})
class HostComponent {
  readonly summary = viewChild.required(ErrorSummaryComponent);
  errors: FormError[] = [
    { message: 'Enter a title', fieldId: 't' },
    { message: 'End must be after start', fieldId: 'e' },
  ];
  picked: FormError | null = null;
}

describe('ErrorSummaryComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    return { fixture, cmp: fixture.componentInstance, host };
  }

  it('is a focusable alert titled with the count', () => {
    const { host } = setup();
    const box = host.querySelector('[role=alert]')!;
    expect(box.getAttribute('tabindex')).toBe('-1');
    expect(box.textContent).toContain('Fix 2 things to submit');
  });

  it('uses singular wording for one error', () => {
    const { fixture, cmp, host } = setup();
    cmp.errors = [cmp.errors[0]];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(host.querySelector('[role=alert]')!.textContent).toContain('Fix 1 thing to submit');
  });

  it('renders nothing without errors', () => {
    const { fixture, cmp, host } = setup();
    cmp.errors = [];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(host.querySelector('[role=alert]')).toBeNull();
  });

  it('lists the errors in order as an ordered list', () => {
    const { host } = setup();
    const items = host.querySelectorAll('[role=alert] ol > li');
    expect(Array.from(items).map((li) => li.textContent!.trim())).toEqual([
      'Enter a title',
      'End must be after start',
    ]);
  });

  it('lists a link per error that moves focus to its field', () => {
    const { fixture, cmp, host } = setup();
    const links = host.querySelectorAll<HTMLAnchorElement>('li a');
    expect(Array.from(links).map((l) => l.getAttribute('href'))).toEqual(['#t', '#e']);
    links[1].click();
    fixture.detectChanges();
    expect(document.activeElement!.id).toBe('e');
    expect(cmp.picked!.fieldId).toBe('e');
  });

  it('focus() moves focus to the summary', () => {
    const { cmp, host } = setup();
    cmp.summary().focus();
    expect(document.activeElement).toBe(host.querySelector('[role=alert]'));
  });
});
