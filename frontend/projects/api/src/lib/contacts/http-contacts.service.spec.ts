import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { HANDLES_FORBIDDEN } from '../errors';
import { apiTestProviders } from '../shared/api-test-providers';
import { CONTACTS_SERVICE, CreateContactRequest } from './contacts.service';
import { HttpContactsService } from './http-contacts.service';

const request: CreateContactRequest = {
  name: 'Kwame Asante',
  email: 'kwame.asante@example.org',
  phone: null,
  organization: 'Maple Street Church',
  city: 'Toronto',
  notes: 'Pastor.',
};

describe('HttpContactsService', () => {
  let service: HttpContactsService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: CONTACTS_SERVICE, useClass: HttpContactsService },
      ],
    });
    service = TestBed.inject(CONTACTS_SERVICE) as HttpContactsService;
    controller = TestBed.inject(HttpTestingController);
  });

  it.each([
    ['list', () => service.list('gra'), 'GET', '/api/contacts?q=gra', undefined],
    ['list without a term', () => service.list(), 'GET', '/api/contacts', undefined],
    ['get', () => service.get('c1'), 'GET', '/api/contacts/c1', undefined],
    ['create', () => service.create(request), 'POST', '/api/contacts', request],
    ['update', () => service.update('c1', request), 'PUT', '/api/contacts/c1', request],
    ['listArchived', () => service.listArchived(), 'GET', '/api/contacts/archived', undefined],
    ['archive', () => service.archive('c1'), 'POST', '/api/contacts/c1/archive', undefined],
    ['restore', () => service.restore('c1'), 'POST', '/api/contacts/c1/restore', undefined],
    ['delete', () => service.delete('c1'), 'DELETE', '/api/contacts/c1', undefined],
    ['getNotes', () => service.getNotes('c1'), 'GET', '/api/contacts/c1/notes', undefined],
    [
      'addNote',
      () => service.addNote('c1', 'Met at the summit'),
      'POST',
      '/api/contacts/c1/notes',
      { body: 'Met at the summit' },
    ],
    [
      'link',
      () => service.link('c1', 'p9', true),
      'POST',
      '/api/contacts/c1/link',
      { profileId: 'p9', discardNotes: true },
    ],
  ])('%s', (_name, call, method, url, body) => {
    (call() as Observable<unknown>).subscribe();

    const req = controller.expectOne(url);
    expect(req.request.method).toBe(method);
    if (body !== undefined) expect(req.request.body).toEqual(body);
    req.flush(null);
  });

  it('lets the contacts page show its own forbidden state', () => {
    service.list().subscribe();

    expect(controller.expectOne('/api/contacts').request.context.get(HANDLES_FORBIDDEN)).toBe(true);
  });
});
