import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The end-aligned, wrapping button row at the end of a form: the way out first, the primary submit last. */
@Component({
  selector: 'ft-form-actions',
  templateUrl: './form-actions.component.html',
  styleUrl: './form-actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormActionsComponent {}
