import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ICONS } from './icons';

export type IconSize = 'sm' | 'md' | 'lg';

/**
 * Inline SVG icon from the design system set. Decorative (aria-hidden) unless `label` is set.
 * Colour follows `currentColor`; size is sm 16px, md 20px (default) or lg 24px.
 */
@Component({
  selector: 'ft-icon',
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"ft-icon--" + size()' },
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<string>();
  readonly size = input<IconSize>('md');
  readonly label = input<string | null>(null);

  // The paths come from the static, trusted ICONS set, never from user input.
  protected readonly markup = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()] ?? ''),
  );
}
