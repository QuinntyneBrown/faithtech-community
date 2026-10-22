import { Routes } from '@angular/router';

import { ArchivedContactsPage, ContactFormPage, ContactPage, ContactsPage } from './pages';

export const CONTACTS_ROUTES: Routes = [
  { path: '', component: ContactsPage },
  { path: 'new', component: ContactFormPage },
  { path: 'archived', component: ArchivedContactsPage },
  { path: ':id', component: ContactPage },
  { path: ':id/edit', component: ContactFormPage },
];
