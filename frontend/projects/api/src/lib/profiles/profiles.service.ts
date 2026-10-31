import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { ProfileRole } from '../shared';

export interface PhotoDto {
  id: string;
  /** Null while `isStored` is false. */
  url: string | null;
  altText: string;
  isFeatured: boolean;
  uploadedAt: string;
  /** False when the photo is saved but storage was down; the server writes the image later (L2-047). */
  isStored: boolean;
}

/**
 * A profile as a signed-in member sees it (L2-005). Photos are newest first. The chapter is null when there is none, and
 * while chapters are off (L2-141 AC1).
 */
export interface ProfileDto {
  id: string;
  name: string;
  chapterId: string | null;
  chapterName: string | null;
  bio: string | null;
  featuredPhoto: PhotoDto | null;
  photos: PhotoDto[];
  roles: ProfileRole[];
  /** The caller owns this profile. */
  isOwn: boolean;
  /** The caller may change it: the owner, or a System Admin. */
  canEdit: boolean;
}

/** The details a member edits on their own profile (L2-006). No home chapter, or a blank bio, clears it. */
export interface ProfileDetails {
  name: string;
  chapterId: string | null;
  bio: string;
}

/** Contract for the profiles API. Pages depend on PROFILES_SERVICE, never on HttpProfilesService. */
export interface ProfilesService {
  /** A profile by id, or the caller's own with "me". 404 when there is no such profile. */
  getProfile(id: string): Observable<ProfileDto>;
  /** 400 with per-field errors, 403 unless the caller owns the profile or is a System Admin. */
  updateProfile(id: string, details: ProfileDetails): Observable<void>;
  /** JPEG, PNG or WebP up to 5 MB with alt text; at most 10 photos. 400 errors are keyed File or AltText. */
  uploadPhoto(id: string, file: File, altText: string): Observable<PhotoDto>;
  describePhoto(id: string, photoId: string, altText: string): Observable<void>;
  setFeatured(id: string, photoId: string): Observable<void>;
  /** The newest remaining photo becomes featured when the featured one is deleted. */
  deletePhoto(id: string, photoId: string): Observable<void>;
}

export const PROFILES_SERVICE = new InjectionToken<ProfilesService>('PROFILES_SERVICE');
