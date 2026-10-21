import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AvatarColor, AvatarComponent } from '../avatar/avatar.component';
import { ButtonComponent } from '../button/button.component';
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

/**
 * The popover half of FaithTech notifications: latest notices with a "Mark all read" action and a
 * link to the full page. A non-modal dialog; the bell (ft-notification-bell) opens it.
 */
@Component({
  selector: 'ft-notification-panel',
  imports: [AvatarComponent, ButtonComponent, LinkComponent],
  templateUrl: './notification-panel.component.html',
  styleUrl: './notification-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPanelComponent {
  readonly notices = input<Notice[]>([]);
  /** The panel shows only the latest few; the Notifications page holds the history. */
  readonly limit = input(5);
  readonly seeAllHref = input('/notifications');

  readonly markAllRead = output<void>();
  /** The id of the notice whose link was opened (the app marks it read). */
  readonly noticeOpened = output<string>();

  protected readonly shown = computed(() => this.notices().slice(0, this.limit()));
  protected readonly hasUnread = computed(() => this.notices().some((n) => n.unread));
}
