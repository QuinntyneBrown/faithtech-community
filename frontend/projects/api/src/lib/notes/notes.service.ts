import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { PagedResult, Role } from '../shared';

export type NoteVisibility = 'Private' | 'Shared' | 'Global';

/** The block types and their wire names (L2-087). */
export const NOTE_BLOCK_TYPES = [
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bulleted',
  'numbered',
  'todo',
  'quote',
  'callout',
  'code',
  'divider',
  'image',
  'link',
] as const;
export type NoteBlockType = (typeof NOTE_BLOCK_TYPES)[number];

/** The roles a page can be shared with (L2-093 AC2). */
export const NOTE_SHAREABLE_ROLES: Role[] = [
  'CityLead',
  'EventLead',
  'CreateLead',
  'CommunicationsLead',
  'Volunteer',
  'ProductEngineer',
  'Staff',
];

/** A run of text with its marks; `pageId` makes it a page link whose text the server fills (L2-090). */
export interface NoteSpan {
  text: string;
  bold?: boolean | null;
  italic?: boolean | null;
  underline?: boolean | null;
  strike?: boolean | null;
  code?: boolean | null;
  href?: string | null;
  pageId?: string | null;
}

export interface NoteBlock {
  id: string;
  type: NoteBlockType;
  text?: NoteSpan[] | null;
  checked?: boolean | null;
  icon?: string | null;
  url?: string | null;
  caption?: string | null;
  imageId?: string | null;
  alt?: string | null;
}

/** A row of the Notes list (L2-085). */
export interface NotePageSummary {
  id: string;
  title: string;
  icon: string | null;
  ownerId: string;
  ownerName: string;
  isOwn: boolean;
  visibility: NoteVisibility;
  sharedWithYou: boolean;
  updatedAt: string;
  updatedByName: string;
  /** The parent's title, "Private page" when the viewer cannot open it, or null at the top level. */
  parentTitle: string | null;
}

/** A page in a breadcrumb, a child list or backlinks; `id` is null for "Private page". */
export interface NotePageRef {
  id: string | null;
  title: string;
  icon: string | null;
}

export interface NoteAudienceMember {
  id: string;
  name: string;
  city: string | null;
}

export interface NoteAudienceRole {
  role: Role;
  count: number;
}

/** The page at /notes/{id} (L2-086). */
export interface NotePageDto extends NotePageSummary {
  parentId: string | null;
  sharedVia: string | null;
  audience: { members: NoteAudienceMember[]; roles: NoteAudienceRole[] };
  blocks: NoteBlock[];
  version: number;
  createdAt: string;
  archivedAt: string | null;
  canEdit: boolean;
  isAdminView: boolean;
  breadcrumb: NotePageRef[];
  children: NotePageRef[];
  backlinks: NotePageRef[];
  /** The page-link targets the viewer may open; any other page link reads "Private page". */
  links: NotePageRef[];
}

export interface NoteQuery {
  q?: string;
  owner?: 'all' | 'mine' | 'shared';
  page?: number;
}

export interface NoteSave {
  title: string;
  icon: string | null;
  blocks: NoteBlock[];
  version: number;
}

export interface NoteSaved {
  version: number;
  updatedAt: string;
}

/** The 409 body: who saved the newer version and when (L2-094 AC2). */
export interface NoteConflict {
  currentVersion: number;
  updatedByName: string;
  /** The caller saved it, in another tab or on another device. */
  updatedByYou: boolean;
  updatedAt: string;
}

export interface NoteVisibilityChange {
  visibility: NoteVisibility;
  memberIds: string[];
  roles: Role[];
}

export interface ArchivedNote {
  id: string;
  title: string;
  icon: string | null;
  archivedAt: string;
}

export interface NoteMember {
  id: string;
  name: string;
  city: string | null;
  roles: Role[];
}

export interface NoteImageUploaded {
  imageId: string;
}

/**
 * Contract for the notes API (L2-085 to L2-099, ADR 0023 to 0025). Pages depend on NOTES_SERVICE.
 * Visibility is decided by the server: a page the caller may not open answers 404, a change by
 * anyone but its owner or a System Admin answers 403, and a save based on an old version 409.
 */
export interface NotesService {
  list(query: NoteQuery): Observable<PagedResult<NotePageSummary>>;
  create(title?: string | null, parentId?: string | null): Observable<NotePageDto>;
  get(id: string): Observable<NotePageDto>;
  save(id: string, page: NoteSave): Observable<NoteSaved>;
  setVisibility(id: string, change: NoteVisibilityChange): Observable<NotePageDto>;
  move(id: string, parentId: string | null): Observable<NotePageDto>;
  archive(id: string): Observable<void>;
  restore(id: string): Observable<void>;
  archived(): Observable<ArchivedNote[]>;
  linkSuggestions(q: string, exclude?: string): Observable<NotePageRef[]>;
  /** The pages this page can move under: the owner's own, but not itself or its descendants. */
  parentOptions(id: string, q?: string): Observable<NotePageRef[]>;
  members(q: string): Observable<NoteMember[]>;
  uploadImage(id: string, file: File): Observable<NoteImageUploaded>;
  image(id: string, imageId: string): Observable<Blob>;
}

export const NOTES_SERVICE = new InjectionToken<NotesService>('NOTES_SERVICE');
