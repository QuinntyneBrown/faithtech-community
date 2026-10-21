import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { INVITES_SERVICE, InviteDto, InviteStatus, ROLE_LABELS } from '@faithtech-community/api';
import {
  BadgeComponent,
  BadgeVariant,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
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

import { SendInviteDialog } from '../../dialogs';

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
    BadgeComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
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

  protected readonly state = signal<State>('loading');
  protected readonly list = signal<InviteDto[]>([]);
  protected readonly resending = signal<string | null>(null);

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
    this.state.set('loaded');
    this.toasts.show({ variant: 'success', heading: `Invite sent to ${sent.email}` });
  }

  protected async resend(invite: InviteDto): Promise<void> {
    if (this.resending()) return;
    this.resending.set(invite.id);
    try {
      const sent = await firstValueFrom(this.invites.resendInvite(invite.id));
      this.list.update((list) => [sent, ...list]);
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

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.list.set(await firstValueFrom(this.invites.listInvites()));
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }
}
