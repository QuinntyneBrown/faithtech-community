import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export interface FormError {
  message: string;
  /** Id of the field the error belongs to; the link moves focus there. */
  fieldId: string;
}

/** Danger alert listing every problem as a link to its field, focused after a failed submit. */
@Component({
  selector: 'ft-error-summary',
  imports: [IconComponent],
  templateUrl: './error-summary.component.html',
  styleUrl: './error-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorSummaryComponent {
  readonly errors = input<FormError[]>([]);
  /** Title after the count, e.g. "Fix 3 things to publish". */
  readonly action = input('submit');
  readonly errorSelected = output<FormError>();

  private readonly box = viewChild<ElementRef<HTMLElement>>('box');

  protected readonly title = computed(() => {
    const n = this.errors().length;
    return `Fix ${n} ${n === 1 ? 'thing' : 'things'} to ${this.action()}`;
  });

  focus(): void {
    this.box()?.nativeElement.focus();
  }

  protected select(event: Event, error: FormError): void {
    event.preventDefault();
    document.getElementById(error.fieldId)?.focus();
    this.errorSelected.emit(error);
  }
}
