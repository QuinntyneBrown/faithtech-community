import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EVENT_HUBS_SERVICE, RESOURCES_SERVICE } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  ClusterComponent,
  DialogComponent,
  DialogService,
  EmptyStateComponent,
  FileDropzoneComponent,
  FormFieldComponent,
  IconTileComponent,
  InlineMessageComponent,
  ProgressComponent,
  RepeatListComponent,
  RepeatRowComponent,
  StackComponent,
  StepperComponent,
  TextFieldComponent,
  TextareaComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  HubPreviewLinkComponent,
  HubSectionWizardData,
  RowList,
  SectionSaver,
  focusAfterRemove,
  sectionContent,
  textOrNull,
} from '../../hub-sections';
import {
  HubResourceChoice,
  HubResourcePickerData,
  HubResourcePickerDialog,
  hubFileKind,
} from '../hub-resource-picker';

const STEPS = ['What to know first', 'Parking options'] as const;
const MAX_OPTIONS = 6;
const IMAGE_TYPES = 'image/png,image/jpeg,image/gif,image/webp';

type Action = 'next' | 'later' | 'finish';
type Option = ReturnType<typeof option>;

/** A map on its way to Resources. */
interface Upload {
  name: string;
  progress: number;
}

const option = () =>
  new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
    mapResourceId: new FormControl<string | null>(null),
    mapTitle: new FormControl<string | null>(null),
  });

let next = 0;

/**
 * The Parking wizard (L2-173 AC1), matching docs/mocks/dialogs/hub-parking: step 1 is the note shown at the top of
 * Parking; step 2 lists up to 6 options, each with a name, notes and a map: an image chosen from Resources or uploaded
 * (an upload becomes an organisation resource, ADR 0042). Next, Save and finish later and Save each save the whole
 * section; a refusal shows the step that holds the field. Closes with true once saved and done.
 */
@Component({
  selector: 'ft-hub-parking-dialog',
  imports: [
    HubPreviewLinkComponent,
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    ClusterComponent,
    DialogComponent,
    EmptyStateComponent,
    FileDropzoneComponent,
    FormFieldComponent,
    IconTileComponent,
    InlineMessageComponent,
    ProgressComponent,
    RepeatListComponent,
    RepeatRowComponent,
    StackComponent,
    StepperComponent,
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './hub-parking.dialog.html',
  styleUrls: ['../hub-wizard.scss', './hub-parking.dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubParkingDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly hub = inject<HubSectionWizardData>(DIALOG_DATA).hub;
  protected readonly saver = new SectionSaver(
    inject(EVENT_HUBS_SERVICE),
    this.hub.eventId,
    'Parking',
  );
  private readonly resources = inject(RESOURCES_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly list = viewChild('list', { read: ElementRef });
  private readonly addButton = viewChild('add', { read: ElementRef });

  protected readonly steps = STEPS;
  protected readonly statusId = `hub-parking-step-${++next}`;
  protected readonly imageTypes = IMAGE_TYPES;
  protected readonly max = MAX_OPTIONS;
  protected readonly step = signal<1 | 2>(1);
  protected readonly busy = signal<Action | null>(null);
  private last: Action = 'next';

  protected readonly note = new FormControl('', { nonNullable: true });
  protected readonly options = new RowList(option, MAX_OPTIONS, 'Option');
  /** Each map's thumbnail, by resource id, once loaded. */
  protected readonly thumbnails = signal<Partial<Record<string, string>>>({});
  /** The map each option is uploading. */
  protected readonly uploads = signal<ReadonlyMap<Option, Upload>>(new Map());
  /** Why the file an option was given can't be its map. */
  protected readonly mapErrors = signal<ReadonlyMap<Option, string>>(new Map());

  constructor() {
    const content = sectionContent(this.hub, 'Parking');
    this.note.setValue(content?.note ?? '');
    for (const o of content?.options ?? []) {
      this.options.add({
        title: o.title ?? '',
        notes: o.notes ?? '',
        mapResourceId: o.mapResourceId,
        mapTitle: o.mapTitle,
      });
      if (o.mapResourceId) void this.thumb(o.mapResourceId);
    }
    inject(DestroyRef).onDestroy(() =>
      Object.values(this.thumbnails()).forEach((url) => url && URL.revokeObjectURL(url)),
    );
  }

  /** "Remove map from option 1" */
  protected removeMapLabel(index: number): string {
    return `Remove map from option ${index + 1}`;
  }

  /** "3 of 6 options. You can add up to 6 options." */
  protected countLine(): string {
    return `${this.options.count()} of ${MAX_OPTIONS} options. You can add up to ${MAX_OPTIONS} options.`;
  }

  protected mapError(row: Option, index: number): string {
    return this.mapErrors().get(row) ?? this.saver.error(`options[${index}].mapResourceId`);
  }

  protected addOption(): void {
    this.options.add();
    const index = this.options.count() - 1;
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelectorAll('ft-repeat-row')
          [index]?.querySelector<HTMLElement>('input')
          ?.focus(),
      { injector: this.injector },
    );
  }

  /** Removes an option, then moves focus to the next option's name, or to Add an option. */
  protected removeOption(index: number): void {
    this.options.remove(index);
    afterNextRender(
      () => focusAfterRemove(this.list()?.nativeElement, index, this.addButton()?.nativeElement),
      { injector: this.injector },
    );
  }

  /** Choose from Resources: one image for this option's map. */
  protected async chooseMap(row: Option): Promise<void> {
    const ref = this.dialogs.open<HubResourceChoice[], HubResourcePickerData>(
      HubResourcePickerDialog,
      { data: { accept: 'image', multiple: false } },
    );
    const [picked] = (await firstValueFrom(ref.closed)) ?? [];
    if (!picked) return;
    this.setMap(row, picked.id, picked.title);
  }

  protected removeMap(row: Option): void {
    row.patchValue({ mapResourceId: null, mapTitle: null });
    this.setMapError(row, '');
  }

  /** Upload an image: anything but an image is refused before it is sent. */
  protected uploadMap(row: Option, files: File[]): void {
    const file = files[0];
    if (!file) return;
    if (hubFileKind(extensionOf(file.name)) !== 'Image') {
      this.setMapError(row, 'Choose an image.');
      return;
    }
    this.setMapError(row, '');
    void this.upload(row, file);
  }

  /** Next, Save and finish later, or Save: saves the whole section, then moves on or closes. */
  protected async save(action: Action): Promise<void> {
    if (this.busy()) return;
    this.last = action;
    this.busy.set(action);
    const saved = await this.saver.save({
      note: textOrNull(this.note.value),
      options: this.options.array.getRawValue().map((o) => ({
        title: o.title.trim(),
        notes: textOrNull(o.notes),
        mapResourceId: o.mapResourceId,
      })),
    });
    this.busy.set(null);
    if (!saved) {
      // A refusal shows the step that holds the first field it names.
      const paths = Object.keys(this.saver.errors());
      if (paths.length) this.step.set(paths.some((p) => p.startsWith('options')) ? 2 : 1);
      return;
    }
    if (action === 'next') this.step.set(2);
    else this.ref.close(true);
  }

  protected retry(): void {
    void this.save(this.last);
  }

  private setMap(row: Option, id: string, title: string): void {
    row.patchValue({ mapResourceId: id, mapTitle: title });
    this.setMapError(row, '');
    if (!this.thumbnails()[id]) void this.thumb(id);
  }

  private setMapError(row: Option, message: string): void {
    this.mapErrors.update((all) => {
      const copy = new Map(all);
      if (message) copy.set(row, message);
      else copy.delete(row);
      return copy;
    });
  }

  private setUpload(row: Option, upload: Upload | null): void {
    this.uploads.update((all) => {
      const copy = new Map(all);
      if (upload) copy.set(row, upload);
      else copy.delete(row);
      return copy;
    });
  }

  private async upload(row: Option, file: File): Promise<void> {
    this.setUpload(row, { name: file.name, progress: 0 });
    try {
      const events = this.resources.upload(file, {
        tags: [],
        visibility: 'Global',
        memberIds: [],
        roles: [],
      });
      await new Promise<void>((resolve, reject) =>
        events.subscribe({
          next: (event) => {
            if (event.kind === 'progress')
              this.setUpload(row, { name: file.name, progress: event.percent });
            else this.setMap(row, event.resource.id, event.resource.title);
          },
          error: reject,
          complete: resolve,
        }),
      );
    } catch {
      this.setMapError(row, `We couldn’t upload ${file.name}. Try again.`);
    } finally {
      this.setUpload(row, null);
    }
  }

  private async thumb(id: string): Promise<void> {
    try {
      const blob = await firstValueFrom(this.resources.thumbnail(id));
      this.thumbnails.update((all) => ({ ...all, [id]: URL.createObjectURL(blob) }));
    } catch {
      // No thumbnail: the map shows its icon tile.
    }
  }
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1);
}
