import { InjectionToken, Signal } from '@angular/core';

/** What an organisation calls its chapters (L2-140); null when chapters are off. */
export interface ChapterLabel {
  singular: string;
  plural: string;
}

/** A public host's brochure video (Marketing:Sites, L2-134 AC3). */
export interface Brochure {
  url: string;
  posterUrl: string | null;
  captionsUrl: string | null;
  /** The video's accessible name. */
  title: string | null;
  posterAlt: string | null;
}

/** GET /api/site: the organisation of the host the app is served on, readable before sign-in (L2-133 AC1). */
export interface Site {
  name: string;
  shortName: string;
  chapterLabel: ChapterLabel | null;
  communityOrigin: string;
  /** On a public host, its marketing content (L2-134 AC3); null or absent on a community host. */
  headline?: string | null;
  brochure?: Brochure | null;
  footer?: string | null;
}

/** Contract for the site API. Pages depend on SITE_SERVICE, never on HttpSiteService. */
export interface SiteService {
  /** The host's organisation; null until loaded, or when it could not be loaded. */
  readonly site: Signal<Site | null>;
  /** Loads the site once on app start; never rejects, so the app still starts when it fails. */
  load(): Promise<void>;
}

export const SITE_SERVICE = new InjectionToken<SiteService>('SITE_SERVICE');
