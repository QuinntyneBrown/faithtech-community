import { Type } from '@angular/core';
import { HubSectionKind } from '@faithtech-community/api';

import {
  HubAgendaDialog,
  HubDemoFormatDialog,
  HubGivingDialog,
  HubHeroDialog,
  HubJudgingDialog,
  HubLinksDialog,
  HubParkingDialog,
  HubPartnersDialog,
  HubPeopleDialog,
  HubProcessDialog,
  HubRulesDialog,
  HubSlidesDialog,
  HubTracksDialog,
  HubUpcomingDialog,
  HubVenueDialog,
  HubWhatToBringDialog,
  HubWorshipDialog,
} from '../dialogs';

/** Each section's wizard (L2-157), opened from the hub home and, for a template's default, from its page (ADR 0043). */
export const HUB_WIZARDS: Partial<Record<HubSectionKind, Type<unknown>>> = {
  Hero: HubHeroDialog,
  Agenda: HubAgendaDialog,
  Venue: HubVenueDialog,
  People: HubPeopleDialog,
  Links: HubLinksDialog,
  Giving: HubGivingDialog,
  UpcomingEvents: HubUpcomingDialog,
  Parking: HubParkingDialog,
  WhatToBring: HubWhatToBringDialog,
  Partners: HubPartnersDialog,
  Tracks: HubTracksDialog,
  Process: HubProcessDialog,
  Rules: HubRulesDialog,
  DemoFormat: HubDemoFormatDialog,
  Judging: HubJudgingDialog,
  Worship: HubWorshipDialog,
  Slides: HubSlidesDialog,
};

/** The wizards with rows or two steps, opened in the wide panel (docs/mocks/dialogs/hub-agenda, hub-people, hub-rules). */
export const WIDE_HUB_WIZARDS: readonly HubSectionKind[] = [
  'Agenda',
  'People',
  'Parking',
  'WhatToBring',
  'Partners',
  'Tracks',
  'Process',
  'Rules',
  'DemoFormat',
  'Judging',
  'Worship',
  'Slides',
];
