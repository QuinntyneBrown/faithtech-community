import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Read-only progress bar for a known total. Pass `label` (the accessible name, in words) and
 * optionally a visible `caption` such as "6 of 24 points". Turns success green when complete.
 */
@Component({
  selector: 'ft-progress',
  templateUrl: './progress.component.html',
  styleUrl: './progress.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressComponent {
  readonly value = input.required<number>();
  readonly max = input(100);
  readonly label = input.required<string>();
  readonly size = input<'md' | 'lg'>('md');
  readonly caption = input<string | null>(null);

  protected readonly percent = computed(() => {
    const max = this.max();
    if (max <= 0) return 0;
    return Math.min(100, Math.max(0, (this.value() / max) * 100));
  });

  protected readonly complete = computed(() => this.max() > 0 && this.value() >= this.max());
}
