import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { AvatarColor, AvatarComponent } from '../avatar/avatar.component';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

let nextId = 0;

/**
 * One person in a `ft-person-grid` (docs/design-system/components/person-card.html): a decorative cover
 * band in the person's colour, a large round photo (with its description as alt text) or their initials,
 * the name as a heading with a status badge (`badge` slot), a two-line subtitle, a secondary line, a
 * full-width *View profile* link and, with `dismissLabel`, a round × that emits `dismissed`; the page
 * confirms before acting. There is no connect or follow action.
 */
@Component({
  selector: 'ft-person-card',
  imports: [AvatarComponent, ButtonComponent, IconComponent],
  templateUrl: './person-card.component.html',
  styleUrl: './person-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'listitem' },
})
export class PersonCardComponent {
  readonly name = input.required<string>();
  /** The featured photo; null shows the initials. */
  readonly photoSrc = input<string | null>(null);
  /** The photo's description, written by whoever added it. */
  readonly photoAlt = input('');
  /** Cover tint and initials colour, from the person's id (ADR 0008). */
  readonly color = input<AvatarColor>('plain');
  /** "{organisation} · {city}", cut to two lines. */
  readonly subtitle = input('');
  /** One short fact, such as "2 notes" or "Added Thu 9 Oct". */
  readonly secondary = input('');
  readonly href = input.required<string>();
  readonly actionLabel = input('View profile');
  /** Accessible name of the × button, such as "Archive Tomás Ortega"; without it there is no × button. */
  readonly dismissLabel = input<string | null>(null);
  readonly dismissed = output<void>();

  protected readonly nameId = `ft-person-card-name-${nextId++}`;
  private readonly failedSrc = signal<string | null>(null);
  protected readonly photo = computed(() => {
    const src = this.photoSrc();
    return src && src !== this.failedSrc() ? src : null;
  });

  protected photoFailed(src: string): void {
    this.failedSrc.set(src);
  }
}
