import { Routes } from '@angular/router';

import { AnnouncementsPage, ComposeAnnouncementPage, UnsubscribePage } from './pages';

export const ANNOUNCEMENTS_ROUTES: Routes = [
  { path: '', component: AnnouncementsPage },
  { path: 'new', component: ComposeAnnouncementPage },
];

/** The anonymous landing page of an announcement email's unsubscribe link (L2-030 AC3). */
export const UNSUBSCRIBE_ROUTES: Routes = [{ path: '', component: UnsubscribePage }];
