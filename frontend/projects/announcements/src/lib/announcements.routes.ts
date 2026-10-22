import { Routes } from '@angular/router';

import { canSendAnnouncements } from './can-send.guard';
import { AnnouncementsPage, ComposeAnnouncementPage, SettingsPage, UnsubscribePage } from './pages';

export const ANNOUNCEMENTS_ROUTES: Routes = [
  { path: '', component: AnnouncementsPage },
  { path: 'new', component: ComposeAnnouncementPage, canActivate: [canSendAnnouncements] },
];

/** The settings screen holds the announcement email opt-out (ADR 0016). */
export const SETTINGS_ROUTES: Routes = [{ path: '', component: SettingsPage }];

/** Anonymous: the email footer's link, outside the signed-in shell (L2-030 AC3). */
export const UNSUBSCRIBE_ROUTES: Routes = [{ path: '', component: UnsubscribePage }];
