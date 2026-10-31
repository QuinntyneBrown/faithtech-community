import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AUTH_SERVICE } from '@faithtech-community/api';
import {
  AuthLayoutComponent,
  ButtonComponent,
  CardComponent,
  IconTileComponent,
  ListComponent,
  ListItemComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

/**
 * Shown to a signed-in account with no profile in the host's organisation, in place of every other page: who it is
 * signed in as, the organisations it does belong to, and a way out (L2-132 AC3, docs/mocks/pages/not-a-member).
 */
@Component({
  selector: 'ft-not-a-member-page',
  imports: [
    AuthLayoutComponent,
    ButtonComponent,
    CardComponent,
    IconTileComponent,
    ListComponent,
    ListItemComponent,
  ],
  templateUrl: './not-a-member.page.html',
  styleUrl: './not-a-member.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotAMemberPage {
  private readonly auth = inject(AUTH_SERVICE);

  protected readonly refusal = this.auth.notAMember;
  protected readonly lead = computed(() => {
    const r = this.refusal();
    if (!r) return '';
    const elsewhere = r.memberships.length ? ', or go to an organisation you belong to' : '';
    return `You’re signed in as ${r.email}, which has no profile here. Ask someone in ${r.organisation.name} to invite you${elsewhere}.`;
  });

  protected async signOut(): Promise<void> {
    await firstValueFrom(this.auth.signOut());
  }
}
