import { CdkDrag } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

/**
 * A card in a kanban column: the name as a link, a caption, and a Move button that names the card.
 * Movable cards can also be dragged with a pointer. Read-only viewers (`movable` false) get
 * neither the button nor the drag. Place inside ft-kanban-column.
 */
@Component({
  selector: 'ft-kanban-card',
  imports: [ButtonComponent, IconComponent],
  templateUrl: './kanban-card.component.html',
  styleUrl: './kanban-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [CdkDrag],
  host: { role: 'listitem' },
})
export class KanbanCardComponent {
  private readonly drag = inject(CdkDrag);

  /** Identifies the card in drop events and `moveRequested`. */
  readonly cardId = input.required<unknown>();
  readonly title = input.required<string>();
  readonly href = input.required<string>();
  readonly caption = input('');
  readonly movable = input(true);

  /** The Move button was pressed; the app opens its move dialog. */
  readonly moveRequested = output<unknown>();

  constructor() {
    effect(() => {
      this.drag.data = this.cardId();
      this.drag.disabled = !this.movable();
    });
  }
}
