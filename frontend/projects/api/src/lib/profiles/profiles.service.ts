import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Role } from '../shared';

export interface PhotoDto {
  id: string;
  url: string;
  altText: string;
  isFeatured: boolean;
  uploadedAt: string;
}

/** A profile as a signed-in member sees it (L2-005). Photos are newest first. */
export interface ProfileDto {
  id: string;
  name: string;
  homeCity: string | null;
  bio: string | null;
  featuredPhoto: PhotoDto | null;
  photos: PhotoDto[];
  roles: Role[];
  /** The caller owns this profile. */
  isOwn: boolean;
  /** The caller may change it: the owner, or a System Admin. */
  canEdit: boolean;
}

/** Contract for the profiles API. Pages depend on PROFILES_SERVICE, never on HttpProfilesService. */
export interface ProfilesService {
  /** A profile by id, or the caller's own with "me". 404 when there is no such profile. */
  getProfile(id: string): Observable<ProfileDto>;
}

export const PROFILES_SERVICE = new InjectionToken<ProfilesService>('PROFILES_SERVICE');
