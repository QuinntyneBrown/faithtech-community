import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The wrapping button row at the end of a form: primary submit, then a way out. */
@Component({
  selector: 'ft-form-actions',
  templateUrl: './form-actions.component.html',
  styleUrl: './form-actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormActionsComponent {}
