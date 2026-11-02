import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

let nextId = 0;

type Move = 'up' | 'down';

/**
 * One row card of an `ft-repeat-list`: a group named by its `heading` ("Rule 01"), with Move up, Move down and Remove
 * named after the row's `object` (the heading when empty), then the row's fields as content. The row asks the
 * caller to move or remove it through `moveUp`, `moveDown` and `remove`. After a move, focus stays on the moved row's
 * button, or on its other move button once that one is disabled; track rows by identity so the row moves with its
 * item. After a remove the caller moves focus (to the next row, or to the Add button).
 */
@Component({
  selector: 'ft-repeat-row',
  imports: [ButtonComponent, IconComponent],
  templateUrl: './repeat-row.component.html',
  styleUrl: './repeat-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'listitem' },
})
export class RepeatRowComponent {
  private readonly injector = inject(Injector);

  /** The row's heading, such as "Rule 01". */
  readonly heading = input.required<string>();
  /** The row's name in its buttons ("Move Start fresh up"); the heading when empty. */
  readonly object = input<string | null>('');
  /** The first row cannot move up. */
  readonly first = input(false, { transform: booleanAttribute });
  /** The last row cannot move down. */
  readonly last = input(false, { transform: booleanAttribute });

  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
  readonly remove = output<void>();

  protected readonly headingId = `ft-repeat-row-heading-${nextId++}`;
  protected readonly name = computed(() => this.object()?.trim() || this.heading());

  private readonly upButton = viewChild.required('upButton', { read: ElementRef });
  private readonly downButton = viewChild.required('downButton', { read: ElementRef });

  protected move(direction: Move): void {
    if (direction === 'up') this.moveUp.emit();
    else this.moveDown.emit();
    afterNextRender(() => this.restoreFocus(direction), { injector: this.injector });
  }

  private restoreFocus(direction: Move): void {
    const disabled = direction === 'up' ? this.first() : this.last();
    const target = (direction === 'up') !== disabled ? this.upButton() : this.downButton();
    (target.nativeElement as HTMLElement).querySelector('button')?.focus();
  }
}
