import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { EVENT_HUBS_SERVICE, RESOURCES_SERVICE } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  DialogService,
  EmptyStateComponent,
  FileDropzoneComponent,
  FileRowComponent,
  FileRowStatus,
  IconTileComponent,
  InlineMessageComponent,
  ListComponent,
  RepeatListComponent,
  RepeatRowComponent,
  StackComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  HubPreviewLinkComponent,
  HubSectionWizardData,
  SectionSaver,
  sectionContent,
} from '../../hub-sections';
import {
  HubResourceChoice,
  HubResourcePickerData,
  HubResourcePickerDialog,
  hubFileKind,
} from '../hub-resource-picker';

const MAX_SLIDES = 60;
const WRONG_TYPE = 'Choose a PDF or an image.';
const TOO_MANY = `You can add up to ${MAX_SLIDES} slides.`;

/** A slide as the wizard lists it; `thumbnail` is an object URL once the image's small version has loaded. */
interface Slide extends HubResourceChoice {
  /** Tracks the row, even when the same resource is a slide twice. */
  key: number;
  thumbnail: string | null;
}

/** A file on its way to Resources. */
interface Upload {
  name: string;
  status: FileRowStatus;
  progress: number;
}

let next = 0;

/**
 * The Slides wizard (L2-182 AC1), matching docs/mocks/dialogs/hub-slides: up to 60 slides, each an image or a PDF from
 * Resources, chosen there or uploaded (an upload becomes an organisation resource, ADR 0042), in the order visitors
 * see them. Closes with true once saved.
 */
@Component({
  selector: 'ft-hub-slides-dialog',
  imports: [
    HubPreviewLinkComponent,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    EmptyStateComponent,
    FileDropzoneComponent,
    FileRowComponent,
    IconTileComponent,
    InlineMessageComponent,
    ListComponent,
    RepeatListComponent,
    RepeatRowComponent,
    StackComponent,
  ],
  templateUrl: './hub-slides.dialog.html',
  styleUrls: ['../hub-wizard.scss', './hub-slides.dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubSlidesDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly data = inject<HubSectionWizardData>(DIALOG_DATA);
  protected readonly hub = this.data.hub;
  /** Set when the wizard edits a template's default (ADR 0043). */
  protected readonly template = this.data.template;
  protected readonly saver = new SectionSaver(
    inject(EVENT_HUBS_SERVICE),
    this.hub.eventId,
    'Slides',
    this.template,
  );
  private readonly resources = inject(RESOURCES_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly questionId = `hub-slides-q-${++next}`;
  protected readonly accept = 'application/pdf,image/png,image/jpeg,image/gif,image/webp';
  protected readonly slides = signal<readonly Slide[]>([]);
  protected readonly uploads = signal<readonly Upload[]>([]);
  /** Why the last files chosen couldn't all be added. */
  protected readonly fileError = signal('');
  private keys = 0;

  protected readonly uploading = computed(
    () => this.uploads().filter((u) => u.status === 'uploading').length,
  );
  protected readonly full = computed(() => this.slides().length + this.uploading() >= MAX_SLIDES);
  /** "12 of 60 slides. You can add up to 60 slides.", with how many are still uploading. */
  protected readonly countLine = computed(() => {
    const uploading = this.uploading() ? `, ${this.uploading()} uploading` : '';
    return `${this.slides().length} of ${MAX_SLIDES} slides${uploading}. ${TOO_MANY}`;
  });
  /** Messages the server gave for the slides, such as a slide that is no longer in Resources. */
  protected readonly slideErrors = computed(() =>
    Object.entries(this.saver.errors())
      .filter(([path]) => path.startsWith('slides'))
      .map(([, message]) => message),
  );

  constructor() {
    for (const s of sectionContent(this.hub, 'Slides')?.slides ?? [])
      this.append({ id: s.resourceId, title: s.title, kind: s.kind });
    inject(DestroyRef).onDestroy(() =>
      this.slides().forEach((s) => s.thumbnail && URL.revokeObjectURL(s.thumbnail)),
    );
  }

  protected heading(index: number): string {
    return `Slide ${String(index + 1).padStart(2, '0')}`;
  }

  /** Choose from Resources: appended in the order ticked, up to the limit. */
  protected async chooseFromResources(): Promise<void> {
    const ref = this.dialogs.open<HubResourceChoice[], HubResourcePickerData>(
      HubResourcePickerDialog,
      { data: { accept: 'slides', multiple: true } },
    );
    const picked = await firstValueFrom(ref.closed);
    if (!picked?.length) return;
    const room = MAX_SLIDES - this.slides().length - this.uploading();
    this.fileError.set(picked.length > room ? TOO_MANY : '');
    picked.slice(0, Math.max(0, room)).forEach((choice) => this.append(choice));
  }

  /** Upload slides: images and PDFs go to Resources; anything else is refused before it is sent. */
  protected filesChosen(files: File[]): void {
    const wanted = files.filter((f) => hubFileKind(extensionOf(f.name)));
    const room = MAX_SLIDES - this.slides().length - this.uploading();
    this.fileError.set(
      wanted.length < files.length ? WRONG_TYPE : wanted.length > room ? TOO_MANY : '',
    );
    wanted.slice(0, Math.max(0, room)).forEach((file) => this.upload(file));
  }

  protected removeUpload(upload: Upload): void {
    this.uploads.update((all) => all.filter((u) => u !== upload));
  }

  protected move(index: number, by: -1 | 1): void {
    const to = index + by;
    this.slides.update((all) => {
      if (to < 0 || to >= all.length) return all;
      const copy = [...all];
      [copy[index], copy[to]] = [copy[to]!, copy[index]!];
      return copy;
    });
  }

  /** Removes a slide, then moves focus to the next slide's first button, or to Choose from Resources. */
  protected remove(index: number): void {
    const slide = this.slides()[index];
    if (slide?.thumbnail) URL.revokeObjectURL(slide.thumbnail);
    this.slides.update((all) => all.filter((_, i) => i !== index));
    afterNextRender(
      () => {
        const host = this.host.nativeElement;
        const row = host.querySelectorAll('ft-repeat-row')[index];
        const target =
          row?.querySelector<HTMLElement>('button:not([disabled])') ??
          host.querySelector<HTMLElement>('[data-choose] button');
        target?.focus();
      },
      { injector: this.injector },
    );
  }

  protected async save(): Promise<void> {
    const saved = await this.saver.save({
      slides: this.slides().map((s) => ({ resourceId: s.id })),
    });
    if (saved) this.ref.close(true);
  }

  private append(choice: HubResourceChoice): void {
    const slide: Slide = { ...choice, key: ++this.keys, thumbnail: null };
    this.slides.update((all) => [...all, slide]);
    if (choice.kind === 'Image') void this.thumb(slide);
  }

  private async upload(file: File): Promise<void> {
    let upload: Upload = { name: file.name, status: 'uploading', progress: 0 };
    const replace = (changed: Upload) => {
      this.uploads.update((all) => all.map((u) => (u === upload ? changed : u)));
      upload = changed;
    };
    this.uploads.update((all) => [...all, upload]);
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
            if (event.kind === 'progress') replace({ ...upload, progress: event.percent });
            else {
              this.removeUpload(upload);
              const kind = hubFileKind(event.resource.extension ?? extensionOf(file.name));
              if (kind) this.append({ id: event.resource.id, title: event.resource.title, kind });
            }
          },
          error: reject,
          complete: resolve,
        }),
      );
    } catch {
      replace({ ...upload, status: 'failed' });
    }
  }

  private async thumb(slide: Slide): Promise<void> {
    try {
      const blob = await firstValueFrom(this.resources.thumbnail(slide.id));
      const url = URL.createObjectURL(blob);
      if (!this.slides().some((s) => s.key === slide.key)) return URL.revokeObjectURL(url);
      this.slides.update((all) =>
        all.map((s) => (s.key === slide.key ? { ...s, thumbnail: url } : s)),
      );
    } catch {
      // No thumbnail: the row shows its icon tile.
    }
  }
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1);
}
