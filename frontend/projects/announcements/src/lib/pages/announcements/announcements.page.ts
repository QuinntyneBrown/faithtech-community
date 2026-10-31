import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AnnouncementDto,
  ANNOUNCEMENTS_SERVICE,
  AUTH_SERVICE,
  OrganisationNames,
  ROLE_LABELS,
  hasAny,
} from '@faithtech-community/api';
import {
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  IconTileComponent,
  ListComponent,
  ListItemComponent,
  ListSkeletonComponent,
  PageHeaderComponent,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'loading' | 'loaded' | 'error';

/**
 * The announcements sent to the member, newest first (L2-030, mock `pages/announcements`). Communications
 * Leads and System Admins also see what they sent, and New announcement (ADR 0016).
 */
@Component({
  selector: 'ft-announcements-page',
  imports: [
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
    IconTileComponent,
    ListComponent,
    ListItemComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
  ],
  templateUrl: './announcements.page.html',
  styleUrl: './announcements.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnouncementsPage {
  protected readonly organisation = inject(OrganisationNames);
  private readonly service = inject(ANNOUNCEMENTS_SERVICE);
  private readonly capabilities = inject(AUTH_SERVICE).capabilities;

  protected readonly state = signal<State>('loading');
  protected readonly items = signal<AnnouncementDto[]>([]);
  protected readonly hasMore = signal(false);
  protected readonly loadingMore = signal(false);
  /** SendAnnouncements composes and sends (L2-034, L2-135 AC7). */
  protected readonly canSend = computed(() => hasAny(this.capabilities(), 'SendAnnouncements'));
  private page = 1;

  constructor() {
    void this.load();
  }

  protected meta(a: AnnouncementDto): string {
    const recipients = `${a.recipientCount} ${a.recipientCount === 1 ? 'recipient' : 'recipients'}`;
    return `To ${audience(a)} · Sent ${formatDay(a.sentAt)} by ${a.senderName} · ${recipients}`;
  }

  protected retry(): void {
    void this.load();
  }

  protected async showOlder(): Promise<void> {
    this.loadingMore.set(true);
    try {
      const next = await firstValueFrom(this.service.list(this.page + 1));
      this.page = next.page;
      this.items.update((items) => [...items, ...next.items]);
      this.hasMore.set(next.page * next.pageSize < next.totalCount);
    } finally {
      this.loadingMore.set(false);
    }
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      const first = await firstValueFrom(this.service.list(1));
      this.page = 1;
      this.items.set(first.items);
      this.hasMore.set(first.page * first.pageSize < first.totalCount);
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }
}

/** "Everyone", "Product Engineers, Volunteers" or "RSVPs: Toronto Builders Night". */
function audience(a: AnnouncementDto): string {
  if (a.audienceKind === 'EventRsvps') return `RSVPs: ${a.eventTitle ?? 'an event'}`;
  if (a.audienceKind === 'Roles') {
    return a.roles.map((r) => (r === 'Staff' ? 'Staff' : `${ROLE_LABELS[r]}s`)).join(', ');
  }
  return 'Everyone';
}
