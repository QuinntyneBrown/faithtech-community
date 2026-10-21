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
import { PROFILES_SERVICE, ProfileDto, ROLE_LABELS } from '@faithtech-community/api';
import {
  ButtonComponent,
  EmptyStateComponent,
  IconComponent,
  ProfileHeaderComponent,
  ProfilePhoto,
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

  /** Route parameter: a profile id, or "me". */
  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly profile = signal<ProfileDto | null>(null);

  protected readonly roles = computed(() => this.profile()?.roles.map((r) => ROLE_LABELS[r]) ?? []);
  protected readonly photos = computed<ProfilePhoto[]>(
    () => this.profile()?.photos.map((p) => ({ url: p.url, alt: p.altText })) ?? [],
  );

  constructor() {
    effect(() => void this.load(this.id()));
  }

  protected retry(): void {
    void this.load(this.id());
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
