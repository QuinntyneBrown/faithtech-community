import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { StickerComponent } from '../sticker/sticker.component';

export type EstimateVote = number | '?';

/**
 * Read-only planning-poker vote tile (the design system's estimate card). Before the reveal it
 * shows a tick (voted) or an ellipsis (still choosing) so nobody is anchored; after, the points.
 * Named for assistive technology: "Grace Okonkwo: 8 points".
 */
@Component({
  selector: 'ft-estimate-card',
  imports: [StickerComponent],
  templateUrl: './estimate-card.component.html',
  styleUrl: './estimate-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimateCardComponent {
  readonly person = input.required<string>();
  readonly vote = input<EstimateVote | null>(null);
  readonly revealed = input(false);
  readonly size = input<'md' | 'lg'>('md');

  protected readonly text = computed(() => {
    const vote = this.vote();
    if (vote === null) return '…';
    return this.revealed() ? String(vote) : '✓';
  });

  protected readonly label = computed(() => {
    const vote = this.vote();
    const name = this.person();
    if (vote === null) return `${name}: still choosing`;
    if (!this.revealed()) return `${name}: voted`;
    if (vote === '?') return `${name}: unsure`;
    return `${name}: ${vote} ${vote === 1 ? 'point' : 'points'}`;
  });
}
