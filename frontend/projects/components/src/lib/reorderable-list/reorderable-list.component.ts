import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  contentChild,
  effect,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';

import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';
import { ReorderableActionsDirective } from './reorderable-actions.directive';
import { ReorderableItem } from './reorderable-item';

/**
 * A list whose order is a setting (docs/design-system/components/reorderable-list): each row has a drag handle, Move
 * up and Move down buttons and its actions, and every move is announced in a polite live region (the L2-089 pattern).
 * Drag and drop is an enhancement; the buttons are the accessible way to move (WCAG 2.5.7). It shows the order it is
 * given, moves a row at once and emits the new order of ids; the opener saves it and gives back the order to show.
 */
@Component({
  selector: 'ft-reorderable-list',
  imports: [CdkDrag, CdkDragHandle, CdkDropList, NgTemplateOutlet, ButtonComponent, IconComponent],
  templateUrl: './reorderable-list.component.html',
  styleUrl: './reorderable-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReorderableListComponent {
  /** The list's accessible name, such as the plural label "Cities". */
  readonly label = input.required<string>();
  readonly items = input<readonly ReorderableItem[]>([]);
  /** No handle, move buttons or actions: a reader of the settings, or an archived view. */
  readonly readonly = input(false);
  /** The ids in their new order, after a move by button or by drag. */
  readonly reordered = output<string[]>();

  protected readonly actions = contentChild(ReorderableActionsDirective);
  protected readonly rows = signal<readonly ReorderableItem[]>([]);
  protected readonly moved = signal<string | null>(null);
  protected readonly announcement = signal('');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  constructor() {
    effect(() => this.rows.set(this.items()));
  }

  protected move(item: ReorderableItem, direction: 'up' | 'down'): void {
    const from = this.rows().indexOf(item);
    this.place(from, direction === 'up' ? from - 1 : from + 1);
    // A row moved to an end disables the button pressed; keep focus on the row's other move button.
    afterNextRender(
      () => {
        const pressed = this.button(item, direction);
        if (pressed?.disabled) this.button(item, direction === 'up' ? 'down' : 'up')?.focus();
      },
      { injector: this.injector },
    );
  }

  protected dropped(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex !== event.currentIndex)
      this.place(event.previousIndex, event.currentIndex);
  }

  private place(from: number, to: number): void {
    const rows = [...this.rows()];
    if (to < 0 || to >= rows.length) return;
    const [item] = rows.splice(from, 1);
    rows.splice(to, 0, item);
    this.rows.set(rows);
    this.moved.set(item.id);
    this.announcement.set(
      `Moved ${item.title} ${to < from ? 'up' : 'down'} to position ${to + 1} of ${rows.length}.`,
    );
    this.reordered.emit(rows.map((r) => r.id));
  }

  private button(item: ReorderableItem, direction: 'up' | 'down'): HTMLButtonElement | null {
    const name = `Move ${item.title} ${direction}`;
    const buttons =
      this.host.nativeElement.querySelectorAll<HTMLButtonElement>('button[aria-label]');
    return Array.from(buttons).find((b) => b.getAttribute('aria-label') === name) ?? null;
  }
}
