import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { InlineMessageComponent } from '../inline-message/inline-message.component';

let nextId = 0;

/** Fixed widths for a filter field in a filter row: sm 12rem, md 14rem, lg 16rem. */
export type FormFieldWidth = 'auto' | 'sm' | 'md' | 'lg';

/**
 * Label, control, help and error stacked in one block. The projected control
 * (ft-text-field, ft-textarea, ft-select) reads its id, aria-describedby and
 * aria-invalid from this component. `width` holds a filter field (a select in a filter row) to a
 * fixed width; by default the field takes the width of its container.
 */
@Component({
  selector: 'ft-form-field',
  imports: [InlineMessageComponent],
  templateUrl: './form-field.component.html',
  styleUrl: './form-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'width() === "auto" ? "" : "ft-form-field--" + width()',
  },
})
export class FormFieldComponent {
  private readonly uid = `ft-field-${nextId++}`;

  readonly label = input.required<string>();
  /** Adds "(optional)" to the label. Required fields carry no marker. */
  readonly optional = input(false);
  /**
   * Announces the control as required (`aria-required`) before anyone submits. The label carries
   * no visible marker; validation stays with the page, so native `required` is not used.
   */
  readonly required = input(false, { transform: booleanAttribute });
  readonly help = input('');
  readonly error = input('');
  readonly width = input<FormFieldWidth>('auto');

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
