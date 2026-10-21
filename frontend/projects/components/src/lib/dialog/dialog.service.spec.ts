import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogRef } from '@angular/cdk/dialog';
import { DialogComponent } from './dialog.component';
import { DialogService } from './dialog.service';

@Component({
  imports: [DialogComponent],
  template: `<ft-dialog
    heading="Cancel your RSVP?"
    description="Spot goes to the waitlist."
    (closed)="ref.close('x')"
    ><input
  /></ft-dialog>`,
})
class ContentComponent {
  readonly ref = inject(DialogRef);
}

const tick = () => new Promise((resolve) => setTimeout(resolve));

describe('DialogService', () => {
  afterEach(() => TestBed.inject(DialogService).closeAll());

  it('opens a modal container with role and aria-modal, labelled by its title', async () => {
    TestBed.inject(DialogService).open(ContentComponent);
    await tick();
    const container = document.querySelector('.cdk-dialog-container') as HTMLElement;
    expect(container.getAttribute('role')).toBe('dialog');
    expect(container.getAttribute('aria-modal')).toBe('true');
    const title = container.querySelector('h2') as HTMLElement;
    expect(container.getAttribute('aria-labelledby')).toBe(title.id);
  });

  it('emits the result on closed and removes the dialog', async () => {
    const ref = TestBed.inject(DialogService).open<string>(ContentComponent);
    await tick();
    const closed = new Promise((resolve) => ref.closed.subscribe(resolve));
    (document.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click();
    expect(await closed).toBe('x');
    expect(document.querySelector('.cdk-dialog-container')).toBeNull();
  });

  it('closes on Escape', async () => {
    TestBed.inject(DialogService).open(ContentComponent);
    await tick();
    document
      .querySelector('.cdk-dialog-container')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    await tick();
    expect(document.querySelector('.cdk-dialog-container')).toBeNull();
  });
});
