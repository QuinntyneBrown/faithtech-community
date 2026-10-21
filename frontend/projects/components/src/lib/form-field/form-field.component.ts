import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { InlineMessageComponent } from '../inline-message/inline-message.component';

let nextId = 0;

/**
 * Label, control, help and error stacked in one block. The projected control
 * (ft-text-field, ft-textarea, ft-select) reads its id, aria-describedby and
 * aria-invalid from this component.
 */
@Component({
  selector: 'ft-form-field',
  imports: [InlineMessageComponent],
  templateUrl: './form-field.component.html',
  styleUrl: './form-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormFieldComponent {
  private readonly uid = `ft-field-${nextId++}`;

  readonly label = input.required<string>();
  /** Adds "(optional)" to the label. Required fields carry no marker. */
  readonly optional = input(false);
  readonly help = input('');
  readonly error = input('');

  readonly controlId = computed(() => `${this.uid}-control`);
  readonly helpId = computed(() => `${this.uid}-help`);
  readonly errorId = computed(() => `${this.uid}-error`);
  readonly invalid = computed(() => this.error() !== '');
  readonly describedBy = computed(() => {
    const ids = [this.help() ? this.helpId() : '', this.error() ? this.errorId() : ''].filter(
      Boolean,
    );
    return ids.length ? ids.join(' ') : null;
  });
}
