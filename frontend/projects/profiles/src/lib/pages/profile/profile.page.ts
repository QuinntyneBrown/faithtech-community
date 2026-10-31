import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  AUTH_SERVICE,
  OrganisationNames,
  ProfileDto,
  PROFILES_SERVICE,
  ROLE_LABELS,
  ROLES_SERVICE,
} from '@faithtech-community/api';
import {
  avatarColorFor,
  ButtonComponent,
  DialogService,
  EmptyStateComponent,
  IconComponent,
  ProfileHeaderComponent,
  ProfilePhoto,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { RoleMode, addableRoles, openRoleDialog, removableRoles } from '../../role-actions';

type State = 'loading' | 'loaded' | 'not-found' | 'error';

/** A member's profile (L2-005), matching docs/mocks/pages/profile. `id` may be "me". */
@Component({
  selector: 'ft-profile-page',
  imports: [ButtonComponent, EmptyStateComponent, IconComponent, ProfileHeaderComponent],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  protected readonly organisation = inject(OrganisationNames);
  private readonly profiles = inject(PROFILES_SERVICE);
  private readonly rolesService = inject(ROLES_SERVICE);
  private readonly dialogs = inject(DialogService);
  /** Roles the caller may change on anyone's profile (L2-009, ADR 0005). */
  private readonly callerRoles = inject(AUTH_SERVICE).roles;

  /** Route parameter: a profile id, or "me". */
  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly profile = signal<ProfileDto | null>(null);

  protected readonly avatarColor = computed(() => avatarColorFor(this.profile()?.id));
  protected readonly roles = computed(() => this.profile()?.roles.map((r) => ROLE_LABELS[r]) ?? []);
  protected readonly photos = computed<ProfilePhoto[]>(
    () => this.profile()?.photos.map((p) => ({ url: p.url, alt: p.altText })) ?? [],
  );

  /** Roles that could be added: assignable and not yet held. */
  protected readonly canAdd = computed(() => {
    const profile = this.profile();
    return profile ? addableRoles(this.callerRoles(), profile) : [];
  });
  /** Held roles the caller may remove. */
  protected readonly canRemove = computed(() => {
    const profile = this.profile();
    return profile ? removableRoles(this.callerRoles(), profile) : [];
  });

  constructor() {
    effect(() => void this.load(this.id()));
  }

  protected retry(): void {
    void this.load(this.id());
  }

  protected addRole(): void {
    this.openRoleDialog('add');
  }

  protected removeRole(): void {
    this.openRoleDialog('remove');
  }

  private openRoleDialog(mode: RoleMode): void {
    const profile = this.profile();
    if (!profile) return;
    openRoleDialog(this.dialogs, this.rolesService, this.callerRoles(), profile, mode, (roles) =>
      this.profile.update((p) => (p ? { ...p, roles } : p)),
    );
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      this.profile.set(await firstValueFrom(this.profiles.getProfile(id)));
      this.state.set('loaded');
    } catch (error) {
      const notFound = error instanceof HttpErrorResponse && error.status === 404;
      this.state.set(notFound ? 'not-found' : 'error');
    }
  }
}
