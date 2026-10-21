import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { IconComponent } from '../icon/icon.component';

export type DialogTone = 'neutral' | 'danger';

let nextId = 0;

/**
 * The panel inside a CDK dialog: icon, title, description, close button, body and sticky footer.
 * Default content is the body; mark footer buttons with `ftDialogFooter` (Cancel first, primary last).
 * Open it with `DialogService`, which supplies the modal container, focus trap and backdrop.
 */
@Component({
  selector: 'ft-dialog',
  imports: [IconComponent],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogComponent {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly ref = inject(DialogRef, { optional: true });

  readonly heading = input.required<string>();
  readonly description = input<string | null>(null);
  /** Icon naming the task (send, archive, delete). */
  readonly icon = input<string | null>(null);
  readonly tone = input<DialogTone>('neutral');
  /** While busy the Close button is disabled and Escape is ignored. */
  readonly busy = input(false);
  readonly closed = output<void>();

  protected readonly titleId = `ft-dialog-title-${nextId}`;
  protected readonly descriptionId = `ft-dialog-description-${nextId++}`;

  constructor() {
    effect(() => {
      if (this.ref) this.ref.disableClose = this.busy();
    });
    // The CDK container carries role=dialog and aria-modal; label it from this panel.
    afterNextRender(() => {
      const container = this.element.nativeElement.closest('.cdk-dialog-container');
      container?.setAttribute('aria-labelledby', this.titleId);
      if (this.description()) container?.setAttribute('aria-describedby', this.descriptionId);
    });
  }
}
