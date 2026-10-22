import { Routes } from '@angular/router';

import { LandingPage } from './landing';

export const routes: Routes = [
  { path: '', component: LandingPage },
  { path: '**', redirectTo: '' },
];
