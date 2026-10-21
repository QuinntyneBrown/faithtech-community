import { Routes } from '@angular/router';

import { EditProfilePage, PeoplePage, ProfilePage } from './pages';

export const PROFILES_ROUTES: Routes = [
  { path: '', component: PeoplePage },
  { path: 'me/edit', component: EditProfilePage },
  { path: ':id', component: ProfilePage },
];
