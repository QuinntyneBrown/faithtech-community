import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AvatarColor, AvatarComponent } from '../avatar/avatar.component';
import { BadgeComponent } from '../badge/badge.component';
import { IconComponent } from '../icon/icon.component';
import { PhotoComponent } from '../photo/photo.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { StickerComponent } from '../sticker/sticker.component';

export interface ProfilePhoto {
  url: string;
  alt: string;
}

/**
 * Opens a member's profile: avatar (featured photo or initials), name as the page heading, global
 * roles, city and join date, the actions the viewer may take (projected with the `actions`
 * attribute) and the bio. Photos, when given, form a strip under a "Photos" heading.
 */
@Component({
  selector: 'ft-profile-header',
  imports: [
    AvatarComponent,
    BadgeComponent,
    IconComponent,
    PhotoComponent,
    SkeletonComponent,
    StickerComponent,
  ],
  templateUrl: './profile-header.component.html',
  styleUrl: './profile-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileHeaderComponent {
  readonly name = input.required<string>();
  readonly roles = input<string[]>([]);
  readonly location = input('');
  /** For example "March 2024". */
  readonly memberSince = input('');
  readonly bio = input('');
  readonly avatarColor = input<AvatarColor>('plain');
  /** The featured photo; initials are shown when there is none. */
  readonly photoUrl = input<string | null>(null);
  readonly photos = input<ProfilePhoto[]>([]);
  readonly loading = input(false);

  protected readonly where = computed(() =>
    [this.location(), this.memberSince() ? `Member since ${this.memberSince()}` : '']
      .filter(Boolean)
      .join(' · '),
  );
}
