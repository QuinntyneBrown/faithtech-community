import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { IconTileComponent } from '../icon-tile/icon-tile.component';

let nextId = 0;

/**
 * A drop zone around a native file input (design system, file drop zone): drop files on it or
 * choose them with the keyboard. Emits the chosen files; the page decides which it keeps.
 */
@Component({
  selector: 'ft-file-dropzone',
  imports: [IconTileComponent],
  templateUrl: './file-dropzone.component.html',
  styleUrl: './file-dropzone.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileDropzoneComponent {
  readonly heading = input('Drop files here or choose files');
  /** The limits line, read with the input. */
  readonly hint = input('');
  readonly accept = input<string | null>(null);
  readonly multiple = input(true);
  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly filesChosen = output<File[]>();

  protected readonly hintId = `ft-dropzone-${nextId++}-hint`;
  protected readonly dragging = signal(false);

  protected onChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.emit(input.files);
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    if (this.disabled()) return;
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (!this.disabled()) this.emit(event.dataTransfer?.files ?? null);
  }

  private emit(list: FileList | null): void {
    const files = Array.from(list ?? []);
    if (files.length) this.filesChosen.emit(this.multiple() ? files : files.slice(0, 1));
  }
}
