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

const MAX_SONGS = 10;

let next = 0;

const song = () =>
  new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    artist: new FormControl('', { nonNullable: true }),
    url: new FormControl('', { nonNullable: true }),
  });

/**
 * The Worship wizard (L2-181 AC1), matching docs/mocks/dialogs/hub-worship: a note, then up to 10 songs with an artist
 * and an https listen link, in the order the hub lists them. Closes with true once saved.
 */
@Component({
  selector: 'ft-hub-worship-dialog',
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
  templateUrl: './hub-worship.dialog.html',
  styleUrl: '../hub-wizard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubWorshipDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly hub = inject<HubSectionWizardData>(DIALOG_DATA).hub;
  protected readonly saver = new SectionSaver(
    inject(EVENT_HUBS_SERVICE),
    this.hub.eventId,
    'Worship',
  );
  private readonly injector = inject(Injector);
  protected readonly questionId = `hub-worship-q-${++next}`;
  protected readonly songs = new RowList(song, MAX_SONGS, 'Song');
  protected readonly note = new FormControl('', { nonNullable: true });
  private readonly list = viewChild('list', { read: ElementRef });
  private readonly addButton = viewChild('add', { read: ElementRef });

  constructor() {
    const content = sectionContent(this.hub, 'Worship');
    for (const s of content?.songs ?? [])
      this.songs.add({ title: s.title, artist: s.artist ?? '', url: s.url ?? '' });
    this.note.setValue(content?.note ?? '');
  }

  protected remove(index: number): void {
    this.songs.remove(index);
    afterNextRender(
      () => focusAfterRemove(this.list()?.nativeElement, index, this.addButton()?.nativeElement),
      { injector: this.injector },
    );
  }

  protected async save(): Promise<void> {
    const saved = await this.saver.save({
      note: textOrNull(this.note.value),
      songs: this.songs.array.getRawValue().map((s) => ({
        title: s.title.trim(),
        artist: textOrNull(s.artist),
        url: textOrNull(s.url),
      })),
    });
    if (saved) this.ref.close(true);
  }
}
