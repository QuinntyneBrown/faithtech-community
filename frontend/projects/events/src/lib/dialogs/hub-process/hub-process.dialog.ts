import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EVENT_HUBS_SERVICE, HubTitledItem } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormFieldComponent,
  InlineMessageComponent,
  RepeatListComponent,
  RepeatRowComponent,
  StackComponent,
  StepperComponent,
  TextFieldComponent,
  TextareaComponent,
} from '@faithtech-community/components';

import {
  focusAfterRemove,
  HubPreviewLinkComponent,
  HubSectionWizardData,
  RowList,
  SectionSaver,
  sectionContent,
  textOrNull,
} from '../../hub-sections';

const STEPS = ['Name', 'Stages'] as const;
const MAX_STAGES = 8;
const MAX_POINTS = 6;

type Action = 'next' | 'later' | 'finish';

let next = 0;

/** The Points field's lines that say something. */
const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** "Listen: Whose pain have you heard?" as a point: split at the first colon; a line without one is a title only. */
function points(text: string): HubTitledItem[] {
  return lines(text).map((line) => {
    const colon = line.indexOf(':');
    if (colon < 0) return { title: line, detail: null };
    return { title: line.slice(0, colon).trim(), detail: textOrNull(line.slice(colon + 1)) };
  });
}

/** Points as the field shows them, one per line. */
const pointsText = (items: HubTitledItem[]) =>
  items.map((p) => (p.detail ? `${p.title}: ${p.detail}` : p.title)).join('\n');

const stage = () =>
  new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    when: new FormControl('', { nonNullable: true }),
    summary: new FormControl('', { nonNullable: true }),
    points: new FormControl('', { nonNullable: true }),
  });

/**
 * The Process wizard (L2-177 AC1), matching docs/mocks/dialogs/hub-process: step 1 names the process and introduces
 * it; step 2 lists up to 8 stages, each with points written one per line as "Title: detail". Next, Save and finish
 * later and Save each save the whole section; a refusal shows the step with the first message. Closes with true once
 * saved and done.
 */
@Component({
  selector: 'ft-hub-process-dialog',
  imports: [
    HubPreviewLinkComponent,
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    InlineMessageComponent,
    RepeatListComponent,
    RepeatRowComponent,
    StackComponent,
    StepperComponent,
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './hub-process.dialog.html',
  styleUrl: '../hub-wizard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubProcessDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly hub = inject<HubSectionWizardData>(DIALOG_DATA).hub;
  protected readonly saver = new SectionSaver(
    inject(EVENT_HUBS_SERVICE),
    this.hub.eventId,
    'Process',
  );
  private readonly injector = inject(Injector);

  protected readonly steps = STEPS;
  protected readonly statusId = `hub-process-step-${++next}`;
  protected readonly questionId = `hub-process-q-${next}`;
  protected readonly step = signal<1 | 2>(1);
  protected readonly busy = signal<Action | null>(null);
  private last: Action = 'next';

  protected readonly name = new FormControl('', { nonNullable: true });
  protected readonly intro = new FormControl('', { nonNullable: true });
  protected readonly stages = new RowList(stage, MAX_STAGES, 'Stage');
  private readonly list = viewChild('list', { read: ElementRef });
  private readonly addButton = viewChild('add', { read: ElementRef });

  constructor() {
    const content = sectionContent(this.hub, 'Process');
    this.name.setValue(content?.name ?? '');
    this.intro.setValue(content?.intro ?? '');
    for (const s of content?.stages ?? [])
      this.stages.add({
        title: s.title,
        when: s.when ?? '',
        summary: s.summary ?? '',
        points: pointsText(s.points),
      });
  }

  /** "One per line, as “Title: detail”. 4 of 6 lines." */
  protected pointsHelp(text: string): string {
    return `One per line, as “Title: detail”. ${lines(text).length} of ${MAX_POINTS} lines.`;
  }

  /** The first message the server gave for a stage's points, such as "Give this point a title.". */
  protected pointsError(index: number): string {
    const prefix = `stages[${index}].points`;
    return Object.entries(this.saver.errors()).find(([path]) => path.startsWith(prefix))?.[1] ?? '';
  }

  protected remove(index: number): void {
    this.stages.remove(index);
    afterNextRender(
      () => focusAfterRemove(this.list()?.nativeElement, index, this.addButton()?.nativeElement),
      { injector: this.injector },
    );
  }

  /** Next, Save and finish later, or Save: saves the whole section, then moves on or closes. */
  protected async save(action: Action): Promise<void> {
    if (this.busy()) return;
    this.last = action;
    this.busy.set(action);
    const saved = await this.saver.save({
      name: textOrNull(this.name.value),
      intro: textOrNull(this.intro.value),
      stages: this.stages.array.getRawValue().map((s) => ({
        title: s.title.trim(),
        when: textOrNull(s.when),
        summary: textOrNull(s.summary),
        points: points(s.points),
      })),
    });
    this.busy.set(null);
    if (!saved) {
      const first = Object.keys(this.saver.errors())[0];
      if (first === 'name' || first === 'intro') this.step.set(1);
      else if (first?.startsWith('stages')) this.step.set(2);
      return;
    }
    if (action === 'next') this.step.set(2);
    else this.ref.close(true);
  }

  protected retry(): void {
    void this.save(this.last);
  }
}
