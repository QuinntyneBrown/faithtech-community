import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogComponent } from './dialog.component';

@Component({
  imports: [DialogComponent],
  template: `
    <ft-dialog
      heading="Archive Toronto team?"
      description="Everything is kept."
      icon="archive"
      [tone]="tone()"
      [busy]="busy()"
      (closed)="closes = closes + 1"
    >
      <p class="body-content">Toronto team has 9 members.</p>
      <button ftDialogFooter type="button">Cancel</button>
    </ft-dialog>
  `,
})
class HostComponent {
  tone = signal<'neutral' | 'danger'>('neutral');
  busy = signal(false);
  closes = 0;
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  return { fixture, host };
}

describe('DialogComponent', () => {
  it('renders title, description, body and footer slots', () => {
    const { host } = setup();
    expect(host.querySelector('h2')?.textContent).toContain('Archive Toronto team?');
    expect(host.querySelector('.dialog__description')?.textContent).toContain(
      'Everything is kept.',
    );
    expect(host.querySelector('.dialog__body .body-content')).not.toBeNull();
    expect(host.querySelector('.dialog__footer button')?.textContent).toBe('Cancel');
  });

  it('gives the title and description distinct ids for the dialog container', () => {
    const { host } = setup();
    const title = host.querySelector('h2') as HTMLElement;
    const desc = host.querySelector('.dialog__description') as HTMLElement;
    expect(title.id).toBeTruthy();
    expect(desc.id).toBeTruthy();
    expect(title.id).not.toBe(desc.id);
  });

  it('shows a danger icon circle for destructive confirmations', () => {
    const { fixture, host } = setup();
    expect(host.querySelector('.dialog__icon--danger')).toBeNull();
    fixture.componentInstance.tone.set('danger');
    fixture.detectChanges();
    expect(host.querySelector('.dialog__icon--danger')).not.toBeNull();
  });

  it('emits closed from the Close button, which is disabled while busy', () => {
    const { fixture, host } = setup();
    const close = host.querySelector('button[aria-label="Close"]') as HTMLButtonElement;
    close.click();
    expect(fixture.componentInstance.closes).toBe(1);
    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();
    expect(close.disabled).toBe(true);
    expect(host.querySelector('.dialog')?.getAttribute('aria-busy')).toBe('true');
  });
});
