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
  RadioComponent,
  RadioGroupComponent,
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

const STEPS = ['Tracks', 'What good looks like'] as const;
const MAX_TRACKS = 6;
const MAX_MARKS = 6;
/** The "No primary focus" radio's value. */
const NONE = 'none';

type Action = 'next' | 'later' | 'finish';

let next = 0;
let keys = 0;

/** A track; its `key` names its Primary focus radio, so the choice follows the track when it moves. */
const track = () =>
  new FormGroup({
    key: new FormControl(`track-${++keys}`, { nonNullable: true }),
    title: new FormControl('', { nonNullable: true }),
    brief: new FormControl('', { nonNullable: true }),
    linkUrl: new FormControl('', { nonNullable: true }),
    linkText: new FormControl('', { nonNullable: true }),
  });

const line = () =>
  new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    detail: new FormControl('', { nonNullable: true }),
  });

/**
 * The Tracks wizard (L2-176 AC1), matching docs/mocks/dialogs/hub-tracks: step 1 lists up to 6 tracks with a brief and
 * an https link, and which one (if any) is the primary focus; step 2 up to 6 lines of what good looks like. Next, Save
 * and finish later and Save each save the whole section; a refusal shows the step with the first message. Closes with
 * true once saved and done.
 */
@Component({
  selector: 'ft-hub-tracks-dialog',
  imports: [
    HubPreviewLinkComponent,
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    InlineMessageComponent,
    RadioComponent,
    RadioGroupComponent,
    RepeatListComponent,
    RepeatRowComponent,
    StackComponent,
    StepperComponent,
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './hub-tracks.dialog.html',
  styleUrl: '../hub-wizard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubTracksDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly data = inject<HubSectionWizardData>(DIALOG_DATA);
  protected readonly hub = this.data.hub;
  /** Set when the wizard edits a template's default (ADR 0043). */
  protected readonly template = this.data.template;
  protected readonly saver = new SectionSaver(
    inject(EVENT_HUBS_SERVICE),
    this.hub.eventId,
    'Tracks',
    this.template,
  );
  private readonly injector = inject(Injector);

  protected readonly steps = STEPS;
  protected readonly none = NONE;
  protected readonly statusId = `hub-tracks-step-${++next}`;
  protected readonly questionId = `hub-tracks-q-${next}`;
  protected readonly step = signal<1 | 2>(1);
  protected readonly busy = signal<Action | null>(null);
  private last: Action = 'next';

  protected readonly tracks = new RowList(track, MAX_TRACKS, 'Track');
  protected readonly primary = new FormControl(NONE, { nonNullable: true });
  protected readonly good = new RowList(line, MAX_MARKS, 'Line');
  private readonly list = viewChild('list', { read: ElementRef });
  private readonly addButton = viewChild('add', { read: ElementRef });

  constructor() {
    const content = sectionContent(this.hub, 'Tracks');
    for (const t of content?.tracks ?? []) {
      const row = this.tracks.add({
        title: t.title,
        brief: t.brief ?? '',
        linkUrl: t.linkUrl ?? '',
        linkText: t.linkText ?? '',
      });
      if (row && t.primary) this.primary.setValue(row.controls.key.value);
    }
    for (const l of content?.goodLooksLike ?? [])
      this.good.add({ title: l.title, detail: l.detail ?? '' });
  }

  protected removeTrack(index: number): void {
    if (this.tracks.rows[index]?.controls.key.value === this.primary.value)
      this.primary.setValue(NONE);
    this.remove(this.tracks, index);
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
      tracks: this.tracks.array.getRawValue().map((t) => ({
        title: t.title.trim(),
        brief: textOrNull(t.brief),
        linkUrl: textOrNull(t.linkUrl),
        linkText: textOrNull(t.linkText),
        primary: t.key === this.primary.value,
      })),
      goodLooksLike: this.good.array.getRawValue().map((l) => ({
        title: l.title.trim(),
        detail: textOrNull(l.detail),
      })),
    });
    this.busy.set(null);
    if (!saved) {
      const first = Object.keys(this.saver.errors())[0];
      if (first?.startsWith('tracks')) this.step.set(1);
      else if (first?.startsWith('goodLooksLike')) this.step.set(2);
      return;
    }
    if (action === 'next') this.step.set(2);
    else this.ref.close(true);
  }

  protected retry(): void {
    void this.save(this.last);
  }
}
