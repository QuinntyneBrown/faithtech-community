import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RESOURCES_SERVICE, ResourceSummary } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  EmptyStateComponent,
  FormFieldComponent,
  ListComponent,
  ListSkeletonComponent,
  PickerRowComponent,
  StackComponent,
  TextFieldComponent,
  formatDay,
} from '@faithtech-community/components';
import { debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';

/** A resource the hub can show: an image, or a PDF for slides (ADR 0042). */
export interface HubResourceChoice {
  id: string;
  title: string;
  kind: 'Image' | 'Pdf';
}

export interface HubResourcePickerData {
  /** Images only for a map; images and PDFs for slides. */
  accept: 'image' | 'slides';
  /** Slides pick several; a map picks one. */
  multiple: boolean;
}

const IMAGES = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
/** Enough for any organisation's images; the list stops at the last page. */
const MAX_PAGES = 20;

/** "Image" or "Pdf" for a file the hub can show; null for anything else. */
export function hubFileKind(extension: string | null | undefined): 'Image' | 'Pdf' | null {
  const ext = (extension ?? '').toLowerCase();
  if (IMAGES.includes(ext)) return 'Image';
  return ext === 'pdf' ? 'Pdf' : null;
}

/**
 * Choose from Resources (docs/mocks/dialogs/hub-resource-picker): the organisation's images, or images and PDFs for
 * slides, searched by title. Closes with what was chosen, in the order ticked, or undefined.
 */
@Component({
  selector: 'ft-hub-resource-picker-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    EmptyStateComponent,
    FormFieldComponent,
    ListComponent,
    ListSkeletonComponent,
    PickerRowComponent,
    StackComponent,
    TextFieldComponent,
  ],
  templateUrl: './hub-resource-picker.dialog.html',
  styleUrl: '../hub-wizard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubResourcePickerDialog {
  protected readonly ref = inject<DialogRef<HubResourceChoice[]>>(DialogRef);
  protected readonly data = inject<HubResourcePickerData>(DIALOG_DATA);
  private readonly resources = inject(RESOURCES_SERVICE);

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly items = signal<ResourceSummary[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly thumbnails = signal<Partial<Record<string, string>>>({});
  protected readonly chosen = signal<HubResourceChoice[]>([]);
  protected readonly type = this.data.multiple ? 'checkbox' : 'radio';
  protected readonly description =
    this.data.accept === 'image'
      ? 'Pick an image for the map.'
      : 'Pick a PDF or images. They’re added in the order you tick them.';
  /** No images at all, or none matching the search. */
  protected readonly emptyLine = computed(() => {
    const q = this.query().trim();
    if (q) return `Nothing in Resources matches “${q}”.`;
    return this.data.accept === 'image'
      ? 'No images in Resources yet.'
      : 'No images or PDFs in Resources yet.';
  });
  private readonly query = signal('');
  /** Ignores a load that a later search replaced. */
  private loads = 0;
  protected readonly shown = computed(() =>
    (this.items() ?? []).filter((r) => {
      const kind = hubFileKind(r.extension);
      return kind === 'Image' || (kind === 'Pdf' && this.data.accept === 'slides');
    }),
  );

  constructor() {
    void this.load();
    this.search.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => void this.load());
    inject(DestroyRef).onDestroy(() =>
      Object.values(this.thumbnails()).forEach((url) => url && URL.revokeObjectURL(url)),
    );
  }

  /** Every page of Resources matching the search: an image can be anywhere in the list. */
  protected async load(): Promise<void> {
    const load = ++this.loads;
    const q = this.search.value.trim();
    this.failed.set(false);
    this.items.set(null);
    try {
      const items: ResourceSummary[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const result = await firstValueFrom(this.resources.list({ q, page }));
        items.push(...result.items);
        if (result.items.length === 0 || items.length >= result.totalCount) break;
      }
      if (load !== this.loads) return;
      this.query.set(q);
      this.items.set(items);
      for (const r of items)
        if (r.hasThumbnail && hubFileKind(r.extension) && !this.thumbnails()[r.id])
          void this.thumb(r.id);
    } catch {
      if (load === this.loads) this.failed.set(true);
    }
  }

  /** "Image · JPG · Grace Okonkwo · Tue 20 Oct" */
  protected meta(r: ResourceSummary): string {
    const kind = hubFileKind(r.extension) === 'Pdf' ? 'PDF' : 'Image';
    return [kind, (r.extension ?? '').toUpperCase(), r.ownerName, formatDay(r.addedAt)]
      .filter(Boolean)
      .join(' · ');
  }

  protected isChosen(id: string): boolean {
    return this.chosen().some((c) => c.id === id);
  }

  protected pick(r: ResourceSummary, on: boolean): void {
    const choice: HubResourceChoice = { id: r.id, title: r.title, kind: hubFileKind(r.extension)! };
    if (!this.data.multiple) this.chosen.set(on ? [choice] : []);
    else
      this.chosen.update((all) =>
        on ? [...all.filter((c) => c.id !== r.id), choice] : all.filter((c) => c.id !== r.id),
      );
  }

  protected choose(): void {
    this.ref.close(this.chosen());
  }

  private async thumb(id: string): Promise<void> {
    try {
      const blob = await firstValueFrom(this.resources.thumbnail(id));
      this.thumbnails.update((t) => ({ ...t, [id]: URL.createObjectURL(blob) }));
    } catch {
      // No thumbnail: the row shows its icon tile.
    }
  }
}
