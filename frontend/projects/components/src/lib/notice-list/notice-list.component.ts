import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AvatarColor, AvatarComponent } from '../avatar/avatar.component';
import { LinkComponent } from '../link/link.component';

export interface Notice {
  id: string;
  /** The person the notice is about; shown as initials. */
  name: string;
  color?: AvatarColor;
  /** One sentence, past tense. Leave it empty when the link text is the whole sentence. */
  text: string;
  /** The one action: the object of the sentence, as a link. */
  linkText?: string;
  href?: string;
  /** Time, for example "Today, 11:42 am". "Unread" is appended for unread notices. */
  meta: string;
  unread: boolean;
}

/**
 * The `.notice` rows of notifications: initials, a sentence linking to the item and a meta line
 * with the time and "Unread". The bell panel and the Notifications page both list notices with it.
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
  /**
   * When set, a notice link's own navigation is cancelled so the host can finish its work first, such as
   * marking the notice read, and then navigate to its `href`.
   */
  readonly deferNavigation = input(false);
  /** The id of the notice whose link was opened. */
  readonly noticeOpened = output<string>();

  protected open(notice: Notice, event: Event): void {
    if (this.deferNavigation()) event.preventDefault();
    this.noticeOpened.emit(notice.id);
  }
}
