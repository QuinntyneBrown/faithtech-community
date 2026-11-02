import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { HubContentInputByKind, HubOrganisationDto, HubSectionKind } from './event-hubs.service';

/** A template as the Hub templates tab lists it (L2-184 AC1, AC3). */
export interface HubTemplateSummaryDto {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  archived: boolean;
  archivedAtUtc: string | null;
  /** The kinds new hubs show, in catalogue order. */
  shown: HubSectionKind[];
  /** How many hubs were started from it. */
  hubCount: number;
}

/** A default Agenda row: minutes from the event's start (ADR 0041). */
export interface HubTemplateAgendaItem {
  minutes: number;
  title: string;
  detail: string | null;
}

/** One section a template holds; content is the kind's own shape, except an Agenda's rows hold minutes. */
export interface HubTemplateSectionDto {
  kind: HubSectionKind;
  visible: boolean;
  content: Record<string, unknown> | null;
}

/** A template as its page reads it (L2-186 AC1). */
export interface HubTemplateDetailDto {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  archivedAtUtc: string | null;
  hubCount: number;
  sections: HubTemplateSectionDto[];
  organisation: HubOrganisationDto;
}

/** What a template default saves: the hub's input shape, except an Agenda's rows hold minutes. */
export type HubTemplateDefaultInput<K extends HubSectionKind> = K extends 'Agenda'
  ? { items: HubTemplateAgendaItem[] }
  : HubContentInputByKind[K];

/**
 * Contract for the organisation's hub templates in Organisation settings (docs/detailed-designs/events/edit-hub-templates).
 * Reads need ManageOrganisationSettings or ManageRoles; every change needs ManageOrganisationSettings (403). A template of
 * another organisation is 404, and so is a change to an archived one.
 */
export interface HubTemplatesService {
  list(archived: boolean): Observable<HubTemplateSummaryDto[]>;
  get(id: string): Observable<HubTemplateDetailDto>;
  /** 400 keyed `name` or `description`. */
  add(name: string, description: string | null): Observable<HubTemplateSummaryDto>;
  rename(id: string, name: string, description: string | null): Observable<HubTemplateSummaryDto>;
  /** 400 keyed `shown`: "Tick at least one section." */
  setSections(id: string, shown: HubSectionKind[]): Observable<HubTemplateDetailDto>;
  /** 400 keyed by field path, or `kind` for a section each hub fills in. */
  saveDefault<K extends HubSectionKind>(
    id: string,
    kind: K,
    content: HubTemplateDefaultInput<K>,
  ): Observable<void>;
  archive(id: string): Observable<HubTemplateSummaryDto>;
  /** 409 when an active template has its name. */
  restore(id: string): Observable<HubTemplateSummaryDto>;
}

export const HUB_TEMPLATES_SERVICE = new InjectionToken<HubTemplatesService>(
  'HUB_TEMPLATES_SERVICE',
);
