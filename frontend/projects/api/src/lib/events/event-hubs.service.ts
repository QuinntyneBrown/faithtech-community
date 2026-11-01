import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { EventFormat } from './events.service';

/** The hub's section kinds, in the order a new hub lists them (docs/detailed-designs/events/create-event-hub). */
export type HubSectionKind =
  'Hero' | 'Agenda' | 'Venue' | 'People' | 'Links' | 'Giving' | 'UpcomingEvents';

export type HubSectionState = 'Ready' | 'NeedsInfo' | 'Hidden';

/** The event's facts, read from the event on every request; the hub stores none of them (L2-154 AC3). */
export interface HubEventFactsDto {
  title: string;
  startsAt: string;
  endsAt: string;
  format: EventFormat;
  venue: string | null;
  onlineLink: string | null;
  rsvpLink: string;
  isCancelled: boolean;
}

// Each section kind's content: only what the lead types; other features' values are read live (ADR 0038).

export interface HeroContent {
  subtitle: string | null;
}

export interface AgendaItem {
  /** An instant; entered and shown in the member's time zone (L2-159 AC6). */
  startsAt: string;
  title: string;
  detail: string | null;
}

export interface AgendaContent {
  items: AgendaItem[];
}

export interface VenueContent {
  directions: string | null;
}

export type HubPersonRole = 'Mentor' | 'Judge' | 'Speaker';

/** A member (profile id; name and photo read from Profiles) or a guest kept on the hub only (L2-161). */
export interface HubPersonDto {
  profileId: string | null;
  name: string;
  line: string | null;
  role: HubPersonRole;
  photoUrl: string | null;
}

export interface PeopleContent {
  people: HubPersonDto[];
}

/** What People saves: a member's id and role, or a guest's name, line and role. */
export interface HubPersonInput {
  profileId: string | null;
  name: string | null;
  line: string | null;
  role: HubPersonRole;
}

export interface LinksContent {
  submissionUrl: string | null;
  feedbackUrl: string | null;
  /** One of the agenda's row times (L2-160 AC3). */
  codeFreezeAt: string | null;
}

export interface GivingContent {
  line: string | null;
}

export interface UpcomingEventsContent {
  /** 1 to 6; 3 by default (L2-162 AC1). */
  count: number;
}

export interface HubContentByKind {
  Hero: HeroContent;
  Agenda: AgendaContent;
  Venue: VenueContent;
  People: PeopleContent;
  Links: LinksContent;
  Giving: GivingContent;
  UpcomingEvents: UpcomingEventsContent;
}

/** What each kind's wizard saves; People sends inputs, not resolved people. */
export interface HubContentInputByKind extends Omit<HubContentByKind, 'People'> {
  People: { people: HubPersonInput[] };
}

export interface HubSectionDto<K extends HubSectionKind = HubSectionKind> {
  kind: K;
  visible: boolean;
  state: HubSectionState;
  content: HubContentByKind[K];
}

/** The organisation's facts the hub shows: its names and giving link and text (L2-158). */
export interface HubOrganisationDto {
  name: string;
  shortName: string;
  givingLink: string | null;
  givingText: string | null;
}

/** One of the chapter's next public events (L2-162 AC2). */
export interface HubUpcomingEventDto {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  format: EventFormat;
  venue: string | null;
  chapterName: string | null;
}

/** An event's hub as its home shows it (L2-154 AC1), sections in order. */
export interface EventHubDto {
  id: string;
  eventId: string;
  status: 'Draft' | 'Published';
  /** When it was last published; null for a draft (L2-164 AC2). */
  publishedAt: string | null;
  /** On the page read: whether the caller manages hubs, so the page is the preview (L2-166 AC3). */
  canManage?: boolean;
  templateKey: string;
  link: string;
  event: HubEventFactsDto;
  sections: HubSectionDto[];
  organisation: HubOrganisationDto;
  upcomingEvents: HubUpcomingEventDto[];
}

/**
 * What the wizard saves on every Next and on Save and finish later (L2-153 AC5, AC7); a kind left out keeps its
 * visibility.
 */
export interface SaveEventHubRequest {
  /** Left out to keep the starting point step 2 applied (L2-155 AC5). */
  templateKey?: string;
  sections: { kind: HubSectionKind; visible: boolean }[];
}

/** Step 2's choice (L2-169 AC3, L2-170 AC4): a template, a hub to copy, or neither for Blank. */
export interface StartEventHubRequest {
  templateId?: string;
  copyFromEventId?: string;
}

/**
 * Contract for event hubs (docs/detailed-designs/events/create-event-hub). Pages depend on EVENT_HUBS_SERVICE, never on
 * HttpEventHubsService. Every call is 403 without ManageEventHubs and 404 for an unknown event.
 */
/** One of the organisation's hub templates, as step 2 of the wizard lists it (L2-169 AC2). */
/** A hub to copy (L2-170 AC2). */
export interface PastEventHubDto {
  eventId: string;
  title: string;
  startsAt: string;
}

export interface HubTemplateDto {
  id: string;
  name: string;
  description: string;
  /** The section kinds it shows, in catalogue order. */
  shown: HubSectionKind[];
}

export interface EventHubsService {
  /** The organisation's hub templates in order (L2-169 AC2). */
  templates(): Observable<HubTemplateDto[]>;
  /** The organisation's hubs by event title, newest first, at most 20, without the given event (L2-170 AC2). */
  pastHubs(search: string, excludeEventId: string): Observable<PastEventHubDto[]>;
  /** 201 with the hub's id; 409 for a second hub or a cancelled event. */
  create(eventId: string): Observable<{ id: string }>;
  /** 404 when the event has no hub. */
  get(eventId: string): Observable<EventHubDto>;
  /** 400 with field errors for an unknown starting point or section. */
  save(eventId: string, request: SaveEventHubRequest): Observable<void>;
  /** Applies a starting point, replacing every section; answers the hub. 400 for an unknown template or hub to copy. */
  start(eventId: string, request: StartEventHubRequest): Observable<EventHubDto>;
  /**
   * Replaces one section's content (L2-157 AC2); 400 with field errors keyed by path, such as `items[2].title`, and 404
   * for an unknown kind.
   */
  saveSection<K extends HubSectionKind>(
    eventId: string,
    kind: K,
    content: HubContentInputByKind[K],
  ): Observable<void>;
  /** Puts the sections in this order (L2-156 AC4); 400 unless it names every kind exactly once. */
  reorder(eventId: string, kinds: HubSectionKind[]): Observable<void>;
  /**
   * The hub page's read (L2-166): open to anyone, answering only the shown sections; 404 for a hub the caller may not see.
   */
  page(eventId: string): Observable<EventHubDto>;
  /** Publishes the hub, refusing nothing (L2-164 AC1); publishing a published hub refreshes `publishedAt`. */
  publish(eventId: string): Observable<void>;
  /** Returns the hub to Draft and keeps its sections (L2-164 AC3). */
  unpublish(eventId: string): Observable<void>;
}

export const EVENT_HUBS_SERVICE = new InjectionToken<EventHubsService>('EVENT_HUBS_SERVICE');
