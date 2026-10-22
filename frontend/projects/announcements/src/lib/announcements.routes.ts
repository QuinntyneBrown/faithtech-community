import { Routes } from '@angular/router';

import { canSendAnnouncements } from './can-send.guard';
import { AnnouncementsPage, ComposeAnnouncementPage } from './pages';

export const ANNOUNCEMENTS_ROUTES: Routes = [
  { path: '', component: AnnouncementsPage },
  { path: 'new', component: ComposeAnnouncementPage, canActivate: [canSendAnnouncements] },
];
