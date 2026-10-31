import { Directive, TemplateRef, inject } from '@angular/core';

import { ReorderableItem } from './reorderable-item';

/** The row actions of a reorderable list, such as Rename and Archive; `let-item` is the row's item. */
@Directive({ selector: 'ng-template[ftReorderableActions]' })
export class ReorderableActionsDirective {
  readonly template = inject<TemplateRef<{ $implicit: ReorderableItem }>>(TemplateRef);
}
