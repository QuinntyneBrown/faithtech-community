import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * First element on every page. Hidden off screen until it has focus, then moves focus to the
 * `target` landmark (an element id, default "main"; give the target tabindex="-1").
 */
@Component({
  selector: 'ft-skip-link',
  templateUrl: './skip-link.component.html',
  styleUrl: './skip-link.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkipLinkComponent {
  readonly target = input('main');

  protected skip(event: Event): void {
    const el = document.getElementById(this.target());
    if (!el) return;
    event.preventDefault();
    el.focus();
    el.scrollIntoView?.();
  }
}
