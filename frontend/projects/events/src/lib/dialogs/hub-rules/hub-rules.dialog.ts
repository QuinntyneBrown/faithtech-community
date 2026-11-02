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
  FormFieldComponent,
  InlineMessageComponent,
  RepeatListComponent,
  RepeatRowComponent,
  StackComponent,
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

const MAX_RULES = 12;
let next = 0;

const rule = () =>
  new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    detail: new FormControl('', { nonNullable: true }),
  });

/**
 * The Rules wizard (L2-178 AC1), matching docs/mocks/dialogs/hub-rules: up to 12 rules of a title and a detail, in the
 * order the hub numbers them, and a note under the list. Closes with true once saved.
 */
@Component({
  selector: 'ft-hub-rules-dialog',
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
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './hub-rules.dialog.html',
  styleUrl: '../hub-wizard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubRulesDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly hub = inject<HubSectionWizardData>(DIALOG_DATA).hub;
  protected readonly saver = new SectionSaver(
    inject(EVENT_HUBS_SERVICE),
    this.hub.eventId,
    'Rules',
  );
  protected readonly questionId = `hub-rules-q-${++next}`;
  protected readonly rules = new RowList(rule, MAX_RULES, 'Rule');
  protected readonly note = new FormControl('', { nonNullable: true });
  private readonly injector = inject(Injector);
  private readonly list = viewChild('list', { read: ElementRef });
  private readonly addButton = viewChild('add', { read: ElementRef });

  constructor() {
    const content = sectionContent(this.hub, 'Rules');
    for (const r of content?.rules ?? [])
      this.rules.add({ title: r.title, detail: r.detail ?? '' });
    this.note.setValue(content?.note ?? '');
  }

  /** Removes a rule, then focuses the next rule's title, or Add a rule when none follows. */
  protected remove(index: number): void {
    this.rules.remove(index);
    afterNextRender(
      () => focusAfterRemove(this.list()?.nativeElement, index, this.addButton()?.nativeElement),
      { injector: this.injector },
    );
  }

  protected async save(): Promise<void> {
    const saved = await this.saver.save({
      rules: this.rules.array.getRawValue().map((r) => ({
        title: r.title.trim(),
        detail: textOrNull(r.detail),
      })),
      note: textOrNull(this.note.value),
    });
    if (saved) this.ref.close(true);
  }
}
