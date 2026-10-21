import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type CardVariant = 'plain' | 'flush' | 'strip' | 'success';
export type CardHeadingLevel = 2 | 3 | 4;

let nextId = 0;

/**
 * Raised surface that groups one set of content. Not interactive. With a `heading` the card
 * is a named region; the success variant is announced as status. Use `busy` while loading.
 */
@Component({
  selector: 'ft-card',
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()',
    '[attr.role]': 'role()',
    '[attr.aria-labelledby]': 'heading() ? headingId : null',
    '[attr.aria-busy]': 'busy() ? "true" : null',
  },
})
export class CardComponent {
  readonly variant = input<CardVariant>('plain');
  readonly heading = input<string | null>(null);
  readonly headingLevel = input<CardHeadingLevel>(2);
  readonly busy = input(false);

  protected readonly headingId = `ft-card-heading-${nextId++}`;
  protected readonly hostClass = computed(() => `ft-card ft-card--${this.variant()}`);
  protected readonly role = computed(() =>
    this.variant() === 'success' ? 'status' : this.heading() ? 'region' : null,
  );
}
