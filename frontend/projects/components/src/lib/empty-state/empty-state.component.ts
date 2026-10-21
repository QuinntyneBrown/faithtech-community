import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export type EmptyStateVariant = 'empty' | 'error';

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
    '[attr.role]': 'variant() === "error" ? "alert" : null',
  },
})
export class EmptyStateComponent {
  readonly variant = input<EmptyStateVariant>('empty');
  readonly heading = input.required<string>();
  readonly text = input<string | null>(null);
  readonly headingLevel = input<2 | 3>(2);
  /** Icon name; defaults to info (empty) or error. */
  readonly icon = input<string | null>(null);

  protected readonly hostClass = computed(() => `ft-empty ft-empty--${this.variant()}`);
  protected readonly iconName = computed(
    () => this.icon() ?? (this.variant() === 'error' ? 'error' : 'info'),
  );
}
