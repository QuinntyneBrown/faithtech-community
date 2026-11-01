import { Routes } from '@angular/router';

import {
  EventCheckInPage,
  EventFormPage,
  EventHubPage,
  HubPage,
  EventPage,
  EventsPage,
  GuestCancelRsvpPage,
  PublicEventPage,
} from './pages';

export const EVENTS_ROUTES: Routes = [
  { path: '', component: EventsPage, title: 'Events' },
  { path: 'new', component: EventFormPage, title: 'New event' },
  { path: ':id', component: EventPage, title: 'Event' },
  { path: ':id/edit', component: EventFormPage, title: 'Edit event' },
  { path: ':id/check-in', component: EventCheckInPage, title: 'Check-in' },
  { path: ':id/hub', component: EventHubPage, title: 'Event hub' },
];

/** Anonymous routes under /public/events (L2-023): the share page and the guest cancel link. */
export const PUBLIC_EVENT_ROUTES: Routes = [
  { path: ':id', component: PublicEventPage, title: 'Event' },
  // The hub page (L2-163, ADR 0039): the preview now, the published page for visitors with slice 44.
  { path: ':id/hub', component: HubPage, title: 'Event hub' },
  { path: ':id/cancel-rsvp', component: GuestCancelRsvpPage, title: 'Cancel your RSVP' },
];
