import { Routes } from '@angular/router';

import { PartnerFormPage, PartnerPage, PartnersPage } from './pages';

export const PARTNERS_ROUTES: Routes = [
  { path: '', component: PartnersPage },
  { path: ':id', component: PartnerPage },
  { path: ':id/edit', component: PartnerFormPage },
];
