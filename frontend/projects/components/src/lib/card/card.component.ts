import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { IconComponent } from '../icon';

export type CardVariant = 'plain' | 'flush' | 'strip' | 'success' | 'media';
export type CardHeadingLevel = 2 | 3 | 4;

let nextId = 0;

/**
 * Raised surface that groups one set of content. Not interactive. With a `heading` the card
 * is a named region; project a header button beside the title with `ftCardActions` (Members ·
 * Add members). The success variant is announced as status. Use `busy` while loading. The media variant is a
 * flush card that leads with an image (`mediaSrc`, described by `mediaAlt`) above a padded body, such as a parking map.
 */
@Component({
  selector: 'ft-card',
  imports: [NgTemplateOutlet, IconComponent],
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
  /** A decorative icon on its own line above the title, such as `success` on a confirmation card. */
  readonly headingIcon = input<string | null>(null);
  readonly busy = input(false);
  /** Media variant: the image the card leads with. */
  readonly mediaSrc = input<string | null>(null);
  /** Media variant: the image's alt text, describing it (required when there is an image). */
  readonly mediaAlt = input('');

  protected readonly headingId = `ft-card-heading-${nextId++}`;
  protected readonly hostClass = computed(() => `ft-card ft-card--${this.variant()}`);
  protected readonly role = computed(() =>
    this.variant() === 'success' ? 'status' : this.heading() ? 'region' : null,
  );
}
