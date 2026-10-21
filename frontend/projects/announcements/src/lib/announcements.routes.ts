/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/announcements/read-announcements-and-opt-out
 *   - docs/detailed-designs/announcements/send-announcement
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { Routes } from '@angular/router';

import { AnnouncementsPage, ComposeAnnouncementPage } from './pages';

export const ANNOUNCEMENTS_ROUTES: Routes = [
  { path: '', component: AnnouncementsPage },
  { path: 'new', component: ComposeAnnouncementPage },
];
