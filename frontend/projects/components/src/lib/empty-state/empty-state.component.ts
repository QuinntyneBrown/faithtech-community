import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export type EmptyStateVariant = 'empty' | 'error';
/** md fills a page or list; sm stands in for a short list inside a dialog step. */
export type EmptyStateSize = 'md' | 'sm';

/**
 * Shown in place of a list or page body with nothing to show or that failed to load. The error variant
 * is announced as an alert. Project the one next action into the `[actions]` slot.
 */
@Component({
  selector: 'ft-empty-state',
  imports: [IconComponent],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()',
    '[attr.role]': 'role()',
  },
})
export class EmptyStateComponent {
  readonly variant = input<EmptyStateVariant>('empty');
  readonly heading = input.required<string>();
  readonly text = input<string | null>(null);
  /** 1 when the empty state is the whole page, as on an invalid invite link. */
  readonly headingLevel = input<1 | 2 | 3>(2);
  /** Icon name; defaults to info (empty) or error. */
  readonly icon = input<string | null>(null);
  /** sm is announced as a status, so a search that empties a list is heard. */
  readonly size = input<EmptyStateSize>('md');

  protected readonly hostClass = computed(
    () => `ft-empty ft-empty--${this.variant()}${this.size() === 'sm' ? ' ft-empty--sm' : ''}`,
  );
  protected readonly role = computed(() =>
    this.variant() === 'error' ? 'alert' : this.size() === 'sm' ? 'status' : null,
  );
  protected readonly iconSize = computed(() => (this.size() === 'sm' ? 'md' : 'lg'));
  protected readonly iconName = computed(
    () => this.icon() ?? (this.variant() === 'error' ? 'error' : 'info'),
  );
}
