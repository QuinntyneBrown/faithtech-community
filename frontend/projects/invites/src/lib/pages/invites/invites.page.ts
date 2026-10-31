import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AUTH_SERVICE,
  INVITES_SERVICE,
  InviteDto,
  InviteStatus,
  ROLE_LABELS,
  hasAny,
} from '@faithtech-community/api';
import {
  AlertComponent,
  BadgeComponent,
  BadgeVariant,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
  ClusterComponent,
  DialogService,
  EmptyStateComponent,
  IconComponent,
  ListComponent,
  ListItemComponent,
  ListSkeletonComponent,
  PageHeaderComponent,
  ToastService,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { MyQrCodeDialog, SendInviteDialog } from '../../dialogs';

type State = 'loading' | 'loaded' | 'error';

const BADGES: Record<InviteStatus, { variant: BadgeVariant; label: string }> = {
  Pending: { variant: 'info', label: 'Pending' },
  Accepted: { variant: 'success', label: 'Accepted' },
  Expired: { variant: 'warning', label: 'Expired' },
  Revoked: { variant: 'neutral', label: 'Withdrawn' },
};

/** Every lead's invites with their status (L2-010), matching docs/mocks/pages/invites. */
@Component({
  selector: 'ft-invites-page',
  imports: [
    AlertComponent,
    BadgeComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
    ClusterComponent,
    EmptyStateComponent,
    IconComponent,
    ListComponent,
    ListItemComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
  ],
  templateUrl: './invites.page.html',
  styleUrl: './invites.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvitesPage {
  private readonly invites = inject(INVITES_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly capabilities = inject(AUTH_SERVICE).capabilities;

  /** ConnectLink holders have a connect link (L2-080 AC1, AC2, L2-135 AC7). */
  protected readonly hasQrCode = computed(() => hasAny(this.capabilities(), 'ConnectLink'));

  protected readonly state = signal<State>('loading');
  protected readonly list = signal<InviteDto[]>([]);
  protected readonly resending = signal<string | null>(null);
  /** The continuation for the next page; null once every invite is shown. */
  protected readonly next = signal<string | null>(null);
  protected readonly total = signal(0);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);
  protected readonly count = computed(
    () => `Showing ${this.list().length} of ${this.total()} invites`,
  );

  constructor() {
    void this.load();
  }

  protected badge(invite: InviteDto) {
    return BADGES[invite.status];
  }

  /** "Product Engineer · Sent Tue 20 Oct · expires Tue 3 Nov", worded as the mock words it. */
  protected meta(invite: InviteDto): string {
    const role = invite.preassignedRole ? ROLE_LABELS[invite.preassignedRole] : 'No role';
    const status = {
      Pending: `Sent ${this.day(invite.createdAt)} · expires ${this.day(invite.expiresAt)}`,
      Accepted: `Accepted ${this.day(invite.acceptedAt)}`,
      Expired: `Expired ${this.day(invite.expiresAt)}`,
      Revoked: `Withdrawn ${this.day(invite.revokedAt)}`,
    }[invite.status];
    return `${role} · ${status}`;
  }

  protected retry(): void {
    void this.load();
  }

  protected async inviteSomeone(): Promise<void> {
    const ref = this.dialogs.open<InviteDto>(SendInviteDialog, {});
    const sent = await firstValueFrom(ref.closed);
    if (!sent) return;
    this.list.update((list) => [sent, ...list]);
    this.total.update((total) => total + 1);
    this.state.set('loaded');
    this.toasts.show({ variant: 'success', heading: `Invite sent to ${sent.email}` });
  }

  protected showQrCode(): void {
    this.dialogs.open(MyQrCodeDialog, {});
  }

  protected async resend(invite: InviteDto): Promise<void> {
    if (this.resending()) return;
    this.resending.set(invite.id);
    try {
      const sent = await firstValueFrom(this.invites.resendInvite(invite.id));
      this.list.update((list) => [sent, ...list]);
      this.total.update((total) => total + 1);
      this.toasts.show({
        variant: 'success',
        heading: 'Invite sent again',
        text: `${sent.email} has a new link that lasts 14 days.`,
      });
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'That didn’t work',
        text: `We couldn’t resend the invite to ${invite.email}. Try again.`,
      });
    } finally {
      this.resending.set(null);
    }
  }

  private day(value: string | null): string {
    return value ? formatDay(value) : '';
  }

  /** Appends the next page. A failure keeps what is shown and says so next to Show more. */
  protected async loadMore(): Promise<void> {
    const after = this.next();
    if (!after || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    try {
      const page = await firstValueFrom(this.invites.listInvites(after));
      // Invites sent from this page are already at the top; skip them if a page repeats one.
      const shown = new Set(this.list().map((i) => i.id));
      this.list.update((list) => [...list, ...page.items.filter((i) => !shown.has(i.id))]);
      this.next.set(page.next);
      this.total.set(Math.max(page.totalCount, this.list().length));
    } catch {
      this.moreFailed.set(true);
    } finally {
      this.loadingMore.set(false);
    }
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    this.moreFailed.set(false);
    try {
      const page = await firstValueFrom(this.invites.listInvites());
      this.list.set(page.items);
      this.next.set(page.next);
      this.total.set(page.totalCount);
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }
}
