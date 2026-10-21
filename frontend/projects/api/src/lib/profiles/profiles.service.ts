/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/profiles/view-profile
 *   - docs/detailed-designs/profiles/edit-own-profile
 *   - docs/detailed-designs/profiles/manage-profile-photos
 */
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

export interface ProfileDto {
  id: string;
  name: string;
  featuredPhoto: PhotoDto | null;
  photos: PhotoDto[];
  roles: Role[];
}

/**
 * Contract for the profiles API. Pages depend on PROFILES_SERVICE, never on HttpProfilesService.
 * TODO(slice): the design carries only name; home city and bio (L2-006) are not in the DTO yet.
 * TODO(slice): PhotoDto fields are inferred from the entity, the design names none.
 */
export interface ProfilesService {
  getProfile(id: string): Observable<ProfileDto>;
  updateProfile(id: string, changes: { name: string }): Observable<void>;
  /** Max 10 photos, JPEG/PNG/WebP up to 5 MB, alt text required. */
  uploadPhoto(id: string, file: File, altText: string): Observable<PhotoDto>;
  setFeatured(id: string, photoId: string): Observable<void>;
  deletePhoto(id: string, photoId: string): Observable<void>;
}

export const PROFILES_SERVICE = new InjectionToken<ProfilesService>('PROFILES_SERVICE');
