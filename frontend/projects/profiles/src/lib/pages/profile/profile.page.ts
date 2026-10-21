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
  PROFILES_SERVICE,
  ProfileDto,
  ROLES,
  ROLES_SERVICE,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  Role,
  assignableRoles,
  problemDetails,
} from '@faithtech-community/api';
import {
  avatarColorFor,
  ButtonComponent,
  DialogService,
  EmptyStateComponent,
  IconComponent,
  ProfileHeaderComponent,
  ProfilePhoto,
  RoleDialogComponent,
  RoleDialogData,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

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
  private readonly profiles = inject(PROFILES_SERVICE);
  private readonly rolesService = inject(ROLES_SERVICE);
  private readonly dialogs = inject(DialogService);
  /** Roles the caller may change on anyone's profile (L2-009, ADR 0005). */
  private readonly callerRoles = inject(AUTH_SERVICE).roles;
  private readonly assignable = computed(() => assignableRoles(this.callerRoles()));

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
  protected readonly canAdd = computed(() =>
    this.assignable().filter((r) => !this.profile()?.roles.includes(r)),
  );
  /** Held roles the caller may remove. */
  protected readonly canRemove = computed(() =>
    ROLES.filter((r) => this.profile()?.roles.includes(r) && this.assignable().includes(r)),
  );

  constructor() {
    effect(() => void this.load(this.id()));
  }

  protected retry(): void {
    void this.load(this.id());
  }

  protected addRole(): void {
    this.openRoleDialog('add', this.canAdd());
  }

  protected removeRole(): void {
    this.openRoleDialog('remove', this.canRemove());
  }

  private openRoleDialog(mode: 'add' | 'remove', roles: Role[]): void {
    const profile = this.profile();
    if (!profile) return;
    const held = profile.roles.map((r) => ROLE_LABELS[r]);
    const data: RoleDialogData = {
      mode,
      name: profile.name,
      description:
        mode === 'add'
          ? `${profile.name} ${held.length ? `holds ${held.join(', ')}` : 'has no role yet'}. People can hold several roles at once.`
          : `${profile.name} stays a member and keeps any other roles. The change is recorded in the audit log.`,
      options: roles.map((r) => ({
        value: r,
        label: ROLE_LABELS[r],
        description: ROLE_DESCRIPTIONS[r],
      })),
      caption:
        mode === 'add' && !this.callerRoles().includes('SystemAdmin')
          ? 'City Lead, Staff and System Admin can only be granted by a System Admin.'
          : undefined,
      submit: (role) => this.changeRole(profile.id, mode, role as Role),
    };
    this.dialogs.open(RoleDialogComponent, { data });
  }

  /** Resolves to null once the badges show the new roles, or to the server's refusal. */
  private async changeRole(id: string, mode: 'add' | 'remove', role: Role): Promise<string | null> {
    try {
      const call =
        mode === 'add'
          ? this.rolesService.addRole(id, role)
          : this.rolesService.removeRole(id, role);
      const roles = await firstValueFrom(call);
      this.profile.update((p) => (p ? { ...p, roles } : p));
      return null;
    } catch (error) {
      if (error instanceof HttpErrorResponse && (error.status === 403 || error.status === 409)) {
        return problemDetails(error)?.detail ?? 'You can’t make that change.';
      }
      throw error;
    }
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
