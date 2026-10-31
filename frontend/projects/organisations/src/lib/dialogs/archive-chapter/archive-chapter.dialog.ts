import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  ChapterDto,
  ChapterLabel,
  ORGANISATION_SERVICE,
  OrganisationNames,
} from '@faithtech-community/api';
import { AlertComponent, ButtonComponent, DialogComponent } from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface ArchiveChapterData {
  label: ChapterLabel;
  chapter: ChapterDto;
}

/**
 * Archive {name}? (L2-140 AC5), matching docs/mocks/dialogs/archive-chapter: the records that use it keep it, and it
 * leaves every picker and filter; it is never deleted. Closes with true once archived.
 */
@Component({
  selector: 'ft-archive-chapter-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent],
  templateUrl: './archive-chapter.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchiveChapterDialog {
  protected readonly names = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<ArchiveChapterData>(DIALOG_DATA);
  private readonly organisations = inject(ORGANISATION_SERVICE);

  protected readonly name = this.data.chapter.name;
  protected readonly singular = this.data.label.singular.toLowerCase();
  protected readonly tagged =
    this.data.chapter.memberCount === 0
      ? 'It’s never deleted.'
      : `${this.data.chapter.memberCount === 1 ? '1 member is' : `${this.data.chapter.memberCount} members are`} tagged ${this.name}. It’s never deleted.`;
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected async archive(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.organisations.archiveChapter(this.data.chapter.id));
      this.ref.close(true);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
