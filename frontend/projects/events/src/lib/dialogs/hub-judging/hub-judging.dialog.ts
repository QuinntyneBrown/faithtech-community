import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EVENT_HUBS_SERVICE, HonorChosenBy } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FieldTotalComponent,
  FormFieldComponent,
  InlineMessageComponent,
  RepeatListComponent,
  RepeatRowComponent,
  SelectComponent,
  SelectOption,
  StackComponent,
  StepperComponent,
  TextFieldComponent,
  TextareaComponent,
} from '@faithtech-community/components';
import { map, startWith } from 'rxjs';

import {
  HubPreviewLinkComponent,
  HubSectionWizardData,
  RowList,
  SectionSaver,
  focusAfterRemove,
  numberOrNull,
  sectionContent,
  textOrNull,
} from '../../hub-sections';

const STEPS = ['Scoring', 'Honors'] as const;
const MAX_ROWS = 6;
const DEFAULT_TOP_SCORE = '5';

type Action = 'next' | 'later' | 'finish';

let next = 0;

const criterion = () =>
  new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    question: new FormControl('', { nonNullable: true }),
    topMark: new FormControl('', { nonNullable: true }),
    weight: new FormControl('', { nonNullable: true }),
  });

const honor = () =>
  new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    line: new FormControl('', { nonNullable: true }),
    chosenBy: new FormControl<HonorChosenBy>('TopScore', { nonNullable: true }),
  });

/**
 * The Judging and honors wizard (L2-180 AC1, AC2), matching docs/mocks/dialogs/hub-judging: step 1 sets the top score
 * and up to 6 weighted criteria with a live total of the weights; step 2 the honors teams can win, how each is chosen,
 * and a note. Next, Save and finish later and Save each save the whole section; a refusal keeps the step that holds
 * the field. Closes with true once saved and done.
 */
@Component({
  selector: 'ft-hub-judging-dialog',
  imports: [
    HubPreviewLinkComponent,
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FieldTotalComponent,
    FormFieldComponent,
    InlineMessageComponent,
    RepeatListComponent,
    RepeatRowComponent,
    SelectComponent,
    StackComponent,
    StepperComponent,
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './hub-judging.dialog.html',
  styleUrl: '../hub-wizard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubJudgingDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly data = inject<HubSectionWizardData>(DIALOG_DATA);
  protected readonly hub = this.data.hub;
  /** Set when the wizard edits a template's default (ADR 0043). */
  protected readonly template = this.data.template;
  protected readonly saver = new SectionSaver(
    inject(EVENT_HUBS_SERVICE),
    this.hub.eventId,
    'Judging',
    this.template,
  );
  private readonly criteriaList = viewChild('criteriaList', { read: ElementRef });
  private readonly criteriaAdd = viewChild('criteriaAdd', { read: ElementRef });
  private readonly honorsList = viewChild('honorsList', { read: ElementRef });
  private readonly honorsAdd = viewChild('honorsAdd', { read: ElementRef });
  private readonly injector = inject(Injector);

  protected readonly steps = STEPS;
  protected readonly statusId = `hub-judging-step-${++next}`;
  protected readonly step = signal<1 | 2>(1);
  protected readonly busy = signal<Action | null>(null);
  private last: Action = 'next';

  protected readonly topScore = new FormControl(DEFAULT_TOP_SCORE, { nonNullable: true });
  protected readonly criteria = new RowList(criterion, MAX_ROWS, 'Criterion');
  protected readonly honors = new RowList(honor, MAX_ROWS, 'Honor');
  protected readonly note = new FormControl('', { nonNullable: true });
  protected readonly chosenBy: SelectOption[] = [
    { value: 'TopScore', label: 'Top score' },
    { value: 'JudgesPick', label: 'Judges’ pick' },
    { value: 'MentorsPick', label: 'Mentors’ pick' },
    { value: 'Vote', label: 'Everyone’s vote' },
  ];

  private readonly top = toSignal(this.topScore.valueChanges.pipe(startWith(this.topScore.value)), {
    initialValue: this.topScore.value,
  });
  /** "Judges score each team 1 to 5", from the top score as typed. */
  protected readonly topHelp = computed(
    () => `Judges score each team 1 to ${numberOrNull(this.top()) ?? DEFAULT_TOP_SCORE}`,
  );

  private readonly weights = toSignal(
    this.criteria.array.valueChanges.pipe(
      startWith(null),
      map(() => this.criteria.array.getRawValue().map((c) => numberOrNull(c.weight) ?? 0)),
    ),
    { initialValue: [] as number[] },
  );
  /** The weights' running sum, and whether it is the 100% the server asks for. */
  protected readonly total = computed(() => {
    const weights = this.weights();
    const sum = weights.reduce((all, w) => all + w, 0);
    const ok = weights.length === 0 || sum === 100;
    return { ok, text: ok ? `Weights total ${sum}%` : `Weights add up to ${sum}%` };
  });

  constructor() {
    const content = sectionContent(this.hub, 'Judging');
    if (content?.topScore != null) this.topScore.setValue(String(content.topScore));
    for (const c of content?.criteria ?? [])
      this.criteria.add({
        title: c.title,
        question: c.question ?? '',
        topMark: c.topMark ?? '',
        weight: String(c.weight),
      });
    for (const h of content?.honors ?? [])
      this.honors.add({ title: h.title, line: h.line ?? '', chosenBy: h.chosenBy });
    this.note.setValue(content?.note ?? '');
  }

  protected addCriterion(): void {
    this.criteria.add();
  }

  protected addHonor(): void {
    this.honors.add();
  }

  protected removeCriterion(index: number): void {
    this.criteria.remove(index);
    afterNextRender(
      () =>
        focusAfterRemove(
          this.criteriaList()?.nativeElement,
          index,
          this.criteriaAdd()?.nativeElement,
        ),
      { injector: this.injector },
    );
  }

  protected removeHonor(index: number): void {
    this.honors.remove(index);
    afterNextRender(
      () =>
        focusAfterRemove(this.honorsList()?.nativeElement, index, this.honorsAdd()?.nativeElement),
      { injector: this.injector },
    );
  }

  /** Next, Save and finish later, or Save: saves the whole section, then moves on or closes. */
  protected async save(action: Action): Promise<void> {
    if (this.busy()) return;
    this.last = action;
    this.busy.set(action);
    const saved = await this.saver.save({
      topScore: numberOrNull(this.topScore.value),
      criteria: this.criteria.array.getRawValue().map((c) => ({
        title: c.title.trim(),
        question: textOrNull(c.question),
        topMark: textOrNull(c.topMark),
        weight: numberOrNull(c.weight) as number,
      })),
      honors: this.honors.array.getRawValue().map((h) => ({
        title: h.title.trim(),
        line: textOrNull(h.line),
        chosenBy: h.chosenBy,
      })),
      note: textOrNull(this.note.value),
    });
    this.busy.set(null);
    if (!saved) {
      // A refusal shows the step that holds the first field it names.
      const paths = Object.keys(this.saver.errors());
      if (paths.length) this.step.set(paths.some((p) => /^(topScore|criteria)/.test(p)) ? 1 : 2);
      return;
    }
    if (action === 'next') this.step.set(2);
    else this.ref.close(true);
  }

  protected retry(): void {
    void this.save(this.last);
  }
}
