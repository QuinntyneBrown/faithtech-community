import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BadgeComponent, BadgeVariant } from '../badge';
import { IconComponent } from '../icon';

export type ChecklistRowState = 'ready' | 'needs-info' | 'hidden';

const STATES: Record<ChecklistRowState, { text: string; icon: string; variant: BadgeVariant }> = {
  ready: { text: 'Ready', icon: 'success', variant: 'success' },
  'needs-info': { text: 'Needs info', icon: 'error', variant: 'warning' },
  hidden: { text: 'Hidden', icon: 'hidden', variant: 'neutral' },
};

/**
 * One item to finish, such as a hub section (components/checklist-row.html): a state icon, the title and its one line, a
 * Ready, Needs info or Hidden badge, and a trailing `[actions]` slot. Place it inside `ft-list`; it is a list item.
 */
@Component({
  selector: 'ft-checklist-row',
  imports: [BadgeComponent, IconComponent],
  templateUrl: './checklist-row.component.html',
  styleUrl: './checklist-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'listitem', '[class]': '"ft-checklist-row--" + state()' },
})
export class ChecklistRowComponent {
  readonly label = input.required<string>();
  readonly description = input<string | null>(null);
  readonly state = input.required<ChecklistRowState>();

  protected readonly look = computed(() => STATES[this.state()]);
}
