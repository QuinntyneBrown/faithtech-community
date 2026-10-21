import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

export type AvatarColor = 'plain' | 'sky' | 'sun' | 'lilac' | 'sage' | 'rose' | 'mint' | 'peach';
export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Initials on a person's colour. Always decorative (aria-hidden): the name is printed beside it.
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

  protected readonly initials = computed(() => {
    const parts = this.name().trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    const first = parts[0].charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toLocaleUpperCase();
  });
}
