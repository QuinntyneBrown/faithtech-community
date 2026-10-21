import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AvatarColor, AvatarComponent } from '../avatar/avatar.component';
import { formatNoticeTime } from '../format/dates';
import { LinkComponent } from '../link/link.component';

export interface Notice {
  id: string;
  /** The person the notice is about; shown as initials. */
  name: string;
  color?: AvatarColor;
  /** One sentence, past tense. */
  text: string;
  /** The one action: the object of the sentence, as a link. */
  linkText?: string;
  href?: string;
  /** Time, for example "Today, 11:42 am". "Unread" is appended for unread notices. */
  meta: string;
  unread: boolean;
}

/** A stored notification as the API sends it; `toNotice` turns it into a row. */
export interface NoticeRecord {
  id: string;
  title: string;
  linkPath: string;
  actorName: string | null;
  createdAt: string;
  readAt: string | null;
}

/** The whole sentence is the link to the related item; system notices show FaithTech's initial. */
export function toNotice(record: NoticeRecord, now: Date = new Date()): Notice {
  return {
    id: record.id,
    name: record.actorName ?? 'FaithTech',
    text: '',
    linkText: record.title,
    href: record.linkPath,
    meta: formatNoticeTime(record.createdAt, now),
    unread: record.readAt === null,
  };
}

/**
 * The notices of the bell's panel and the Notifications page (`.notice-list`), newest first.
 * A plain click on a notice's link is handed to the app through `noticeOpened`, which marks it
 * read and navigates; a click that opens a new tab or window is left to the browser.
 */
@Component({
  selector: 'ft-notice-list',
  imports: [AvatarComponent, LinkComponent],
  templateUrl: './notice-list.component.html',
  styleUrl: './notice-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoticeListComponent {
  readonly notices = input<Notice[]>([]);
  /** Accessible name of the list when no heading names it. */
  readonly label = input<string | null>(null);

  /** The id of the notice whose link was opened in place; the app marks it read and navigates. */
  readonly noticeOpened = output<string>();

  protected open(event: MouseEvent, id: string): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    this.noticeOpened.emit(id);
  }
}
