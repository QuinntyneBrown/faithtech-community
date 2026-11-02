import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EventHubDto } from '@faithtech-community/api';
import {
  CardComponent,
  StackComponent,
  TableColumn,
  TableComponent,
} from '@faithtech-community/components';

import { chosenByLabel } from './hackathon';
import { sectionContent } from './section-saver';

let next = 0;

/** The Judging and honors display (L2-180 AC3): how judges score, the criteria with their weights, then the honors. */
@Component({
  selector: 'ft-hub-judging',
  imports: [CardComponent, StackComponent, TableComponent],
  templateUrl: './hub-judging.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubJudgingComponent {
  readonly hub = input.required<EventHubDto>();

  protected readonly id = `hub-judging-${++next}`;
  protected readonly content = computed(() => sectionContent(this.hub(), 'Judging'));

  protected readonly chosenBy = chosenByLabel;
  protected readonly top = computed(() => this.content()?.topScore ?? 5);
  protected readonly columns = computed<TableColumn[]>(() => [
    { key: 'number', header: 'Number', hideStackLabel: true },
    { key: 'criterion', header: 'Criterion', rowHeader: true },
    { key: 'question', header: 'The question' },
    { key: 'topMark', header: `Scores a ${this.top()} when` },
  ]);
  protected readonly rows = computed(() =>
    (this.content()?.criteria ?? []).map((c, i) => ({
      number: String(i + 1).padStart(2, '0'),
      criterion: `${c.title} (${c.weight}%)`,
      question: c.question ?? '',
      topMark: c.topMark ?? '',
    })),
  );

  protected number(index: number): string {
    return String(index + 1).padStart(2, '0');
  }
}
