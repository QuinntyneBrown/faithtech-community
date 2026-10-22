import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { COPIED_MS, CopyFieldComponent } from './copy-field.component';

@Component({
  imports: [CopyFieldComponent],
  template: `<ft-copy-field
    label="Your connect link"
    [value]="value()"
    help="Works for anyone."
    (copied)="copies = copies + 1"
  />`,
})
class HostComponent {
  value = signal('https://community.faithtech.example/meet/abc');
  copies = 0;
}

async function setup(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  const q = <T extends Element>(s: string) => fixture.nativeElement.querySelector(s) as T;
  return { fixture, cmp: fixture.componentInstance, q };
}

describe('CopyFieldComponent', () => {
  afterEach(() => vi.useRealTimers());

  it('shows the value read-only under its label', async () => {
    const { q } = await setup(() => Promise.resolve());
    const input = q<HTMLInputElement>('input');
    expect(input.value).toBe('https://community.faithtech.example/meet/abc');
    expect(input.readOnly).toBe(true);
    expect(q('label').textContent).toContain('Your connect link');
  });

  it('copies the value, reads Copied for two seconds and announces it', async () => {
    vi.useFakeTimers();
    const writes: string[] = [];
    const { fixture, cmp, q } = await setup((text) => {
      writes.push(text);
      return Promise.resolve();
    });

    q<HTMLButtonElement>('button').click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    expect(writes).toEqual(['https://community.faithtech.example/meet/abc']);
    expect(cmp.copies).toBe(1);
    expect(q('button').textContent).toContain('Copied');
    expect(q('[role="status"]').textContent).toContain('Link copied to the clipboard.');

    await vi.advanceTimersByTimeAsync(COPIED_MS);
    fixture.detectChanges();
    expect(q('button').textContent).toContain('Copy link');
  });

  it('selects the value when the clipboard is refused', async () => {
    const { fixture, cmp, q } = await setup(() => Promise.reject(new Error('denied')));

    q<HTMLButtonElement>('button').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(cmp.copies).toBe(0);
    expect(q('[role="status"]').textContent).toContain('Select the link and copy it.');
  });
});
