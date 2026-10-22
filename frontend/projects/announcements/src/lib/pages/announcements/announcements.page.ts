import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  ANNOUNCEMENTS_SERVICE,
  AUTH_SERVICE,
  AnnouncementDto,
  ROLE_LABELS,
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

interface Row {
  id: string;
  subject: string;
  meta: string;
  body: string;
}

/** The announcements the member received or sent, newest first (L2-030 AC1), matching docs/mocks/pages/announcements. */
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
  private readonly announcements = inject(ANNOUNCEMENTS_SERVICE);
  private readonly roles = inject(AUTH_SERVICE).roles;

  protected readonly state = signal<State>('loading');
  private readonly items = signal<AnnouncementDto[]>([]);
  private readonly total = signal(0);
  private readonly page = signal(1);
  protected readonly loadingMore = signal(false);

  /** Only they can send; the API refuses everyone else regardless (L2-029 AC3). */
  protected readonly canSend = computed(() =>
    this.roles().some((r) => r === 'CommunicationsLead' || r === 'SystemAdmin'),
  );
  protected readonly rows = computed<Row[]>(() => this.items().map(toRow));
  protected readonly hasMore = computed(() => this.items().length < this.total());

  constructor() {
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  protected async showMore(): Promise<void> {
    this.loadingMore.set(true);
    try {
      const next = await firstValueFrom(this.announcements.list(this.page() + 1));
      this.page.set(next.page);
      this.items.update((items) => [...items, ...next.items]);
      this.total.set(next.totalCount);
    } catch {
      // The button stays, so they can try again.
    } finally {
      this.loadingMore.set(false);
    }
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      const first = await firstValueFrom(this.announcements.list(1));
      this.page.set(1);
      this.items.set(first.items);
      this.total.set(first.totalCount);
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }
}

/** "To Product Engineers · Sent Mon 20 Oct by Hannah Kim · 41 recipients", as the mock words it. */
function toRow(a: AnnouncementDto): Row {
  const to =
    a.audience.kind === 'Roles'
      ? a.audience.roles.map((r) => (r === 'Staff' ? 'Staff' : `${ROLE_LABELS[r]}s`)).join(', ')
      : 'Everyone';
  const recipients = `${a.recipientCount} ${a.recipientCount === 1 ? 'recipient' : 'recipients'}`;
  return {
    id: a.id,
    subject: a.subject,
    meta: `To ${to} · Sent ${formatDay(a.sentAt)} by ${a.senderName} · ${recipients}`,
    body: a.body,
  };
}
