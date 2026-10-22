import { Routes } from '@angular/router';

import { NotePage, NotesPage } from './pages';

export const NOTES_ROUTES: Routes = [
  { path: '', component: NotesPage },
  { path: ':id', component: NotePage },
];
