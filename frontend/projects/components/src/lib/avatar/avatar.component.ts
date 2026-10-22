import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

export type AvatarColor = 'plain' | 'sky' | 'sun' | 'lilac' | 'sage' | 'rose' | 'mint' | 'peach';
export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/**
 * Initials on a person's colour. Always decorative (aria-hidden): the name is printed beside it.
 * With `src` the member's photo covers the initials (`alt=""`), which show again if it fails to load.
 * With `href` it becomes the top-bar style trigger, a link named by `label`.
 */
@Component({
  selector: 'ft-avatar',
  imports: [NgTemplateOutlet],
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  readonly name = input('');
  readonly color = input<AvatarColor>('plain');
  readonly size = input<AvatarSize>('md');
  readonly href = input<string | null>(null);
  /** Accessible name of the link trigger, e.g. "Your profile, Grace Okonkwo". */
  readonly label = input<string | null>(null);
  /** URL of the member's featured photo; initials show without one. */
  readonly src = input<string | null>(null);

  /**
   * Draws the initials with CSS instead of writing them, for an avatar that is the face of another
   * control (the account menu button), so that control's name is only its label (WCAG 2.5.3).
   */
  readonly drawn = input(false);

  protected readonly failedSrc = signal<string | null>(null);

  protected readonly initials = computed(() => {
    const parts = this.name().trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    const first = parts[0].charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toLocaleUpperCase();
  });
}
