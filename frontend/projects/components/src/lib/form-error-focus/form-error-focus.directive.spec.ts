import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormErrorFocusDirective } from './form-error-focus.directive';

@Component({
  imports: [FormErrorFocusDirective],
  template: `<form ftFormErrorFocus (submit)="$event.preventDefault()">
    @if (summary()) {
      <div role="alert" tabindex="-1" id="sum">Fix</div>
    }
    <input id="a" />
    <input id="b" [attr.aria-invalid]="bad() ? 'true' : null" />
  </form>`,
})
class HostComponent {
  focus = viewChild.required(FormErrorFocusDirective);
  summary = signal(false);
  bad = signal(false);
}

describe('FormErrorFocusDirective', () => {
  async function submit(patch: { summary?: boolean; bad?: boolean }) {
    const f = TestBed.createComponent(HostComponent);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const form = f.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    f.componentInstance.summary.set(!!patch.summary);
    f.componentInstance.bad.set(!!patch.bad);
    f.detectChanges();
    await f.whenStable();
    return document.activeElement?.id;
  }

  it('focuses the error summary after a failed submit', async () => {
    expect(await submit({ summary: true, bad: true })).toBe('sum');
  });

  it('focuses an error summary that appears after a server response', async () => {
    const f = TestBed.createComponent(HostComponent);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();

    f.componentInstance.summary.set(true);
    f.componentInstance.focus().focusFirstError();
    f.detectChanges();
    await f.whenStable();

    expect(document.activeElement?.id).toBe('sum');
  });

  it('falls back to the first invalid control', async () => {
    expect(await submit({ bad: true })).toBe('b');
  });

  it('moves focus nowhere when the form is valid', async () => {
    expect(await submit({})).not.toBe('b');
  });
});
