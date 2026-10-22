import { Routes } from '@angular/router';

import { NotificationsPage, SettingsPage } from './pages';

export const NOTIFICATIONS_ROUTES: Routes = [{ path: '', component: NotificationsPage }];

/** Settings: Appearance and the notification email preferences (L2-045 AC6, L2-030 AC2). */
export const SETTINGS_ROUTES: Routes = [{ path: '', component: SettingsPage }];
