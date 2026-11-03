import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AvatarColor, AvatarComponent } from '../avatar/avatar.component';
import { LinkComponent } from '../link/link.component';

export interface Notice {
  id: string;
  /** The person the notice is about; shown as initials. */
  name: string;
  color?: AvatarColor;
  /** Their featured photo; without one the avatar shows initials. */
  photo?: string | null;
  /** The sentence up to its link, past tense. Leave it empty when the link starts the sentence. */
  text: string;
  /** The one action: the object of the sentence, as a link. */
  linkText?: string;
  /** The rest of the sentence after the link, such as " was cancelled". */
  after?: string;
  href?: string;
  /** Time, for example "Today, 11:42 am". "Unread" is appended for unread notices. */
  meta: string;
  unread: boolean;
}

/**
 * Splits a notice's sentence around the phrase that names its item, so only that phrase is the link. Without a
 * phrase, or when the sentence does not contain it, the whole sentence is the link.
 */
export function noticeSentence(
  sentence: string,
  linkText: string | null | undefined,
): Pick<Notice, 'text' | 'linkText' | 'after'> {
  const at = linkText ? sentence.indexOf(linkText) : -1;
  if (!linkText || at < 0) return { text: '', linkText: sentence, after: '' };
  return {
    text: sentence.slice(0, at),
    linkText,
    after: sentence.slice(at + linkText.length),
  };
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
