import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';
import { IconTileComponent } from '../icon-tile/icon-tile.component';
import { InlineMessageComponent } from '../inline-message/inline-message.component';
import { ProgressComponent } from '../progress/progress.component';

/** ready: chosen; uploading: in flight; uploaded: done; failed: didn't upload; refused: can't be added. */
export type FileRowStatus = 'ready' | 'uploading' | 'uploaded' | 'failed' | 'refused';

/**
 * One chosen file in an upload list (design system, file row): its type icon, name, "EXT · size"
 * meta, upload progress or error, and a Remove button. Place rows in an `ft-list`.
 */
@Component({
  selector: 'ft-file-row',
  imports: [
    ButtonComponent,
    IconComponent,
    IconTileComponent,
    InlineMessageComponent,
    ProgressComponent,
  ],
  templateUrl: './file-row.component.html',
  styleUrl: './file-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'listitem', class: 'ft-file-row' },
})
export class FileRowComponent {
  readonly name = input.required<string>();
  /** "PPTX · 24.6 MB", or "Deck · 24.6 MB" in a batch. */
  readonly meta = input('');
  readonly icon = input('file');
  readonly status = input<FileRowStatus>('ready');
  /** 0 to 100 while uploading. */
  readonly progress = input(0);
  /** Why the file can't be added, or didn't upload. */
  readonly error = input<string | null>(null);
  /** Id for the error, so an error summary can link to it. */
  readonly errorId = input<string | null>(null);
  readonly removable = input(true);
  readonly removed = output<void>();

  protected readonly statusLabel = computed(() => {
    switch (this.status()) {
      case 'uploaded':
        return '100% · Uploaded';
      case 'failed':
        return 'Didn’t upload';
      case 'refused':
        return 'Can’t add';
      default:
        return null;
    }
  });
}
