import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Design system link: a native <a href>, always underlined. Use a button for actions that change data. */
@Component({
  selector: 'ft-link',
  templateUrl: './link.component.html',
  styleUrl: './link.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkComponent {
  readonly href = input.required<string>();
  /** Opens in a new tab with `noopener noreferrer`. */
  readonly external = input(false);
  /**
   * Visually hidden object appended to the accessible name where list links repeat,
   * for example "Open" + " Toronto Builders Night". Prefer it to aria-label.
   */
  readonly object = input<string | null>(null);
}
