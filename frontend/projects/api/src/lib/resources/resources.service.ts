import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { PagedResult, Role } from '../shared';

export const RESOURCE_TYPES = [
  'Deck',
  'Logo',
  'Image',
  'Training',
  'Template',
  'Document',
  'Other',
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export type ResourceVisibility = 'Private' | 'Shared' | 'Global';

/** The roles a resource can be shared with (L2-061 AC1). */
export const SHAREABLE_ROLES: Role[] = [
  'CityLead',
  'EventLead',
  'CreateLead',
  'CommunicationsLead',
  'Volunteer',
  'ProductEngineer',
  'Staff',
];

/** A row of the Resources list (L2-055). A link has `linkUrl` and `linkHost`; a file the rest. */
export interface ResourceSummary {
  id: string;
  title: string;
  type: ResourceType;
  fileName: string | null;
  extension: string | null;
  size: number | null;
  linkUrl: string | null;
  linkHost: string | null;
  ownerId: string;
  ownerName: string;
  isOwn: boolean;
  visibility: ResourceVisibility;
  sharedWithYou: boolean;
  hasThumbnail: boolean;
  /** False while the file waits for storage (ADR 0017). */
  isStored: boolean;
  addedAt: string;
}

export interface ResourceAudienceMember {
  id: string;
  name: string;
  city: string | null;
}

export interface ResourceAudienceRole {
  role: Role;
  /** Members holding the role today. */
  count: number;
}

/** The resource page (L2-056). */
export interface ResourceDto extends ResourceSummary {
  description: string | null;
  tags: string[];
  /** "you" or the role a Shared resource reached the viewer through. */
  sharedVia: string | null;
  audience: { members: ResourceAudienceMember[]; roles: ResourceAudienceRole[] };
  updatedAt: string | null;
  updatedByName: string | null;
  fileReplacedAt: string | null;
  fileReplacedByName: string | null;
  archivedAt: string | null;
  purgeAt: string | null;
  canEdit: boolean;
  canTransfer: boolean;
  /** The contributing role the owner no longer holds, for System Admin (L2-064 AC2). */
  ownerLostRole: Role | null;
}

export interface ArchivedResource {
  id: string;
  title: string;
  type: ResourceType;
  extension: string | null;
  size: number | null;
  linkHost: string | null;
  archivedAt: string;
  purgeAt: string;
}

export interface ResourceTagDto {
  name: string;
  count: number;
}

/** A member for the share or new-owner picker. */
export interface ResourceMember {
  id: string;
  name: string;
  city: string | null;
  roles: Role[];
}

export interface ResourceQuery {
  q?: string;
  type?: ResourceType | null;
  tag?: string | null;
  page?: number;
}

/** The fields an add or edit sends (L2-059). Leave title and type out of a batch upload. */
export interface ResourceFields {
  title?: string | null;
  description?: string | null;
  type?: ResourceType | null;
  tags: string[];
  visibility: ResourceVisibility;
  memberIds: string[];
  roles: Role[];
}

export interface ResourceLinkRequest extends ResourceFields {
  url: string;
}

/** An upload in flight: progress from 0 to 100, then the saved resource. */
export type ResourceUploadEvent =
  { kind: 'progress'; percent: number } | { kind: 'done'; resource: ResourceDto };

/**
 * Contract for the resources API (L2-055 to L2-066, ADR 0017). Pages depend on RESOURCES_SERVICE.
 * Visibility is decided by the server: a resource the caller may not open answers 404, and a
 * change by anyone but its owner or a System Admin answers 403.
 */
export interface ResourcesService {
  list(query: ResourceQuery): Observable<PagedResult<ResourceSummary>>;
  tags(q?: string): Observable<ResourceTagDto[]>;
  get(id: string): Observable<ResourceDto>;
  /** The file's bytes, fetched with the member's token (no public URL exists). */
  download(id: string): Observable<Blob>;
  thumbnail(id: string): Observable<Blob>;
  /** One file a request, so each row shows its own progress (ADR 0017). */
  upload(file: File, fields: ResourceFields): Observable<ResourceUploadEvent>;
  addLink(link: ResourceLinkRequest): Observable<ResourceDto>;
  update(id: string, fields: ResourceFields & { url?: string | null }): Observable<ResourceDto>;
  replaceFile(id: string, file: File): Observable<ResourceUploadEvent>;
  archive(id: string): Observable<void>;
  restore(id: string): Observable<void>;
  /** The caller's own archived resources, newest first. */
  archived(): Observable<ArchivedResource[]>;
  /** Members to share with (contributors only). */
  members(q: string): Observable<ResourceMember[]>;
  /** Members who can own resources (System Admin only). */
  ownerCandidates(q: string): Observable<ResourceMember[]>;
  transferOwner(id: string, ownerId: string | null): Observable<ResourceDto>;
}

export const RESOURCES_SERVICE = new InjectionToken<ResourcesService>('RESOURCES_SERVICE');
