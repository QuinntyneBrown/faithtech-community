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
import { EVENT_HUBS_SERVICE } from '@faithtech-community/api';
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

const STEPS = ['What to bring', 'On the day'] as const;
const MAX_BRING = 15;
const MAX_ON_THE_DAY = 10;

type Action = 'next' | 'later' | 'finish';

let next = 0;

const item = () => new FormGroup({ text: new FormControl('', { nonNullable: true }) });

const line = () =>
  new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    detail: new FormControl('', { nonNullable: true }),
  });

/**
 * The What to bring wizard (L2-174 AC1), matching docs/mocks/dialogs/hub-what-to-bring: step 1 lists up to 15 things
 * to bring, one line each; step 2 up to 10 lines of what to expect on the day. Next, Save and finish later and Save
 * each save the whole section; a refusal shows the step with the first message. Closes with true once saved and done.
 */
@Component({
  selector: 'ft-hub-what-to-bring-dialog',
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
  ],
  templateUrl: './hub-what-to-bring.dialog.html',
  styleUrl: '../hub-wizard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubWhatToBringDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly data = inject<HubSectionWizardData>(DIALOG_DATA);
  protected readonly hub = this.data.hub;
  /** Set when the wizard edits a template's default (ADR 0043). */
  protected readonly template = this.data.template;
  protected readonly saver = new SectionSaver(
    inject(EVENT_HUBS_SERVICE),
    this.hub.eventId,
    'WhatToBring',
    this.template,
  );
  private readonly injector = inject(Injector);

  protected readonly steps = STEPS;
  protected readonly statusId = `hub-what-to-bring-step-${++next}`;
  protected readonly questionId = `hub-what-to-bring-q-${next}`;
  protected readonly step = signal<1 | 2>(1);
  protected readonly busy = signal<Action | null>(null);
  private last: Action = 'next';

  protected readonly bring = new RowList(item, MAX_BRING, 'Item');
  protected readonly onTheDay = new RowList(line, MAX_ON_THE_DAY, 'Line');
  private readonly list = viewChild('list', { read: ElementRef });
  private readonly addButton = viewChild('add', { read: ElementRef });

  constructor() {
    const content = sectionContent(this.hub, 'WhatToBring');
    for (const text of content?.bring ?? []) this.bring.add({ text });
    for (const l of content?.onTheDay ?? [])
      this.onTheDay.add({ title: l.title, detail: l.detail ?? '' });
  }

  /** "Item 1": a thing to bring is one line, so its row heading is its field's name. */
  protected itemName(index: number): string {
    return `Item ${index + 1}`;
  }

  /** Removes a row of the step's list (only one list shows at a time), then moves focus on. */
  protected remove(rows: { remove(index: number): void }, i: number): void {
    rows.remove(i);
    afterNextRender(
      () => focusAfterRemove(this.list()?.nativeElement, i, this.addButton()?.nativeElement),
      { injector: this.injector },
    );
  }

  /** Next, Save and finish later, or Save: saves the whole section, then moves on or closes. */
  protected async save(action: Action): Promise<void> {
    if (this.busy()) return;
    this.last = action;
    this.busy.set(action);
    const saved = await this.saver.save({
      bring: this.bring.array.getRawValue().map((b) => b.text.trim()),
      onTheDay: this.onTheDay.array.getRawValue().map((l) => ({
        title: l.title.trim(),
        detail: textOrNull(l.detail),
      })),
    });
    this.busy.set(null);
    if (!saved) {
      const first = Object.keys(this.saver.errors())[0];
      if (first?.startsWith('bring')) this.step.set(1);
      else if (first?.startsWith('onTheDay')) this.step.set(2);
      return;
    }
    if (action === 'next') this.step.set(2);
    else this.ref.close(true);
  }

  protected retry(): void {
    void this.save(this.last);
  }
}
