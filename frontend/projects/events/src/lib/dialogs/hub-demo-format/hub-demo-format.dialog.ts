import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EVENT_HUBS_SERVICE } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FieldTotalComponent,
  FormFieldComponent,
  InlineMessageComponent,
  RepeatListComponent,
  RepeatRowComponent,
  StackComponent,
  TextFieldComponent,
} from '@faithtech-community/components';

import {
  clock,
  focusAfterRemove,
  HubPreviewLinkComponent,
  HubSectionWizardData,
  numberOrNull,
  RowList,
  SectionSaver,
  sectionContent,
  textOrNull,
} from '../../hub-sections';

const MAX_SEGMENTS = 8;
const MAX_TIPS = 5;
let next = 0;

const segment = () =>
  new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    detail: new FormControl('', { nonNullable: true }),
    seconds: new FormControl('', { nonNullable: true }),
  });

const tip = () => new FormGroup({ text: new FormControl('', { nonNullable: true }) });

/** A number as its field shows it. */
const shown = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

/**
 * The Demo format wizard (L2-179 AC1, AC2), matching docs/mocks/dialogs/hub-demo-format: the minutes per demo and for
 * questions, up to 8 segments with a live total against the demo's minutes, and up to 5 tips. The server refuses
 * segments that run over, and its message shows under the total. Closes with true once saved.
 */
@Component({
  selector: 'ft-hub-demo-format-dialog',
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
    StackComponent,
    TextFieldComponent,
  ],
  templateUrl: './hub-demo-format.dialog.html',
  styleUrls: ['../hub-wizard.scss', './hub-demo-format.dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubDemoFormatDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly data = inject<HubSectionWizardData>(DIALOG_DATA);
  protected readonly hub = this.data.hub;
  /** Set when the wizard edits a template's default (ADR 0043). */
  protected readonly template = this.data.template;
  protected readonly saver = new SectionSaver(
    inject(EVENT_HUBS_SERVICE),
    this.hub.eventId,
    'DemoFormat',
    this.template,
  );
  private readonly injector = inject(Injector);
  protected readonly questionId = `hub-demo-format-q-${++next}`;

  protected readonly minutes = new FormControl('', { nonNullable: true });
  protected readonly questionMinutes = new FormControl('', { nonNullable: true });
  protected readonly segments = new RowList(segment, MAX_SEGMENTS, 'Segment');
  protected readonly tips = new RowList(tip, MAX_TIPS, 'Tip');
  private readonly segmentList = viewChild('segmentList', { read: ElementRef });
  private readonly addSegment = viewChild('addSegment', { read: ElementRef });
  private readonly tipList = viewChild('tipList', { read: ElementRef });
  private readonly addTip = viewChild('addTip', { read: ElementRef });

  constructor() {
    const content = sectionContent(this.hub, 'DemoFormat');
    this.minutes.setValue(shown(content?.minutes));
    this.questionMinutes.setValue(shown(content?.questionMinutes));
    for (const s of content?.segments ?? [])
      this.segments.add({ title: s.title, detail: s.detail ?? '', seconds: shown(s.seconds) });
    for (const text of content?.tips ?? []) this.tips.add({ text });
  }

  /** The demo's length in seconds, or null while its minutes are empty or out of range. */
  private demoSeconds(): number | null {
    const m = numberOrNull(this.minutes.value);
    return m !== null && m >= 1 && m <= 30 ? m * 60 : null;
  }

  private segmentSeconds(): number {
    return this.segments.array
      .getRawValue()
      .reduce((sum, s) => sum + Math.max(numberOrNull(s.seconds) ?? 0, 0), 0);
  }

  /** "Segments: 3:00 of 3:00", or "of –" while the minutes are empty. */
  protected total(): string {
    const demo = this.demoSeconds();
    return `Segments: ${clock(this.segmentSeconds())} of ${demo === null ? '–' : clock(demo)}`;
  }

  /** Whether the segments fit in the demo. */
  protected fits(): boolean {
    const demo = this.demoSeconds();
    return demo === null || this.segmentSeconds() <= demo;
  }

  /** "Tip 1": a tip is one line, so its row heading is its field's name. */
  protected tipName(index: number): string {
    return `Tip ${index + 1}`;
  }

  protected removeSegment(index: number): void {
    this.segments.remove(index);
    afterNextRender(
      () =>
        focusAfterRemove(
          this.segmentList()?.nativeElement,
          index,
          this.addSegment()?.nativeElement,
        ),
      { injector: this.injector },
    );
  }

  protected removeTip(index: number): void {
    this.tips.remove(index);
    afterNextRender(
      () => focusAfterRemove(this.tipList()?.nativeElement, index, this.addTip()?.nativeElement),
      { injector: this.injector },
    );
  }

  protected async save(): Promise<void> {
    const saved = await this.saver.save({
      minutes: numberOrNull(this.minutes.value),
      questionMinutes: numberOrNull(this.questionMinutes.value),
      segments: this.segments.array.getRawValue().map((s) => ({
        title: s.title.trim(),
        detail: textOrNull(s.detail),
        // An empty length goes as null so the server can say "Choose how long it runs.".
        seconds: numberOrNull(s.seconds) as number,
      })),
      tips: this.tips.array.getRawValue().map((t) => t.text.trim()),
    });
    if (saved) this.ref.close(true);
  }
}
