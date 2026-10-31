import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button.component';
import { LinkComponent } from '../link/link.component';
import { Notice, NoticeListComponent } from '../notice-list/notice-list.component';

/**
 * The popover half of notifications: latest notices with a "Mark all read" action and a
 * link to the full page. A non-modal dialog; the bell (ft-notification-bell) opens it.
 */
@Component({
  selector: 'ft-notification-panel',
  imports: [ButtonComponent, LinkComponent, NoticeListComponent],
  templateUrl: './notification-panel.component.html',
  styleUrl: './notification-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPanelComponent {
  readonly notices = input<Notice[]>([]);
  /** The panel shows only the latest few; the Notifications page holds the history. */
  readonly limit = input(5);
  readonly seeAllHref = input('/notifications');
  /** Passed to the notice list: the host marks a notice read before it navigates. */
  readonly deferNavigation = input(false);

  readonly markAllRead = output<void>();
  /** The id of the notice whose link was opened (the app marks it read). */
  readonly noticeOpened = output<string>();

  protected readonly shown = computed(() => this.notices().slice(0, this.limit()));
  protected readonly hasUnread = computed(() => this.notices().some((n) => n.unread));
}
