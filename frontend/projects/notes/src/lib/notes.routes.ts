import { Routes } from '@angular/router';

import { ArchivedNotesPage, NotePage, NotesPage } from './pages';

export const NOTES_ROUTES: Routes = [
  { path: '', component: NotesPage },
  { path: 'archived', component: ArchivedNotesPage },
  { path: ':id', component: NotePage },
];
