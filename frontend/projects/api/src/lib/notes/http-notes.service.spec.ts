import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { apiTestProviders } from '../shared/api-test-providers';
import { HttpNotesService } from './http-notes.service';
import { NOTES_SERVICE, NoteSave } from './notes.service';

const save: NoteSave = {
  title: 'Builders Night run sheet',
  icon: '🛠️',
  blocks: [{ id: 'b1', type: 'paragraph', text: [{ text: 'Doors at 6' }] }],
  version: 3,
};

describe('HttpNotesService', () => {
  let service: HttpNotesService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...apiTestProviders(), { provide: NOTES_SERVICE, useClass: HttpNotesService }],
    });
    service = TestBed.inject(NOTES_SERVICE) as HttpNotesService;
    controller = TestBed.inject(HttpTestingController);
  });

  it.each([
    ['list', () => service.list({}), 'GET', '/api/notes', undefined],
    [
      'list filtered',
      () => service.list({ q: 'run sheet', owner: 'mine', page: 2 }),
      'GET',
      '/api/notes?q=run%20sheet&owner=mine&page=2',
      undefined,
    ],
    ['list all owners', () => service.list({ owner: 'all' }), 'GET', '/api/notes', undefined],
    ['create', () => service.create(), 'POST', '/api/notes', { title: null, parentId: null }],
    [
      'create inside',
      () => service.create(null, 'n1'),
      'POST',
      '/api/notes',
      { title: null, parentId: 'n1' },
    ],
    ['get', () => service.get('n1'), 'GET', '/api/notes/n1', undefined],
    ['save', () => service.save('n1', save), 'PUT', '/api/notes/n1', save],
    [
      'setVisibility',
      () => service.setVisibility('n1', { visibility: 'Shared', memberIds: ['p2'], roles: [] }),
      'PUT',
      '/api/notes/n1/visibility',
      { visibility: 'Shared', memberIds: ['p2'], roles: [] },
    ],
    ['move', () => service.move('n1', null), 'PUT', '/api/notes/n1/parent', { parentId: null }],
    ['archive', () => service.archive('n1'), 'POST', '/api/notes/n1/archive', undefined],
    ['restore', () => service.restore('n1'), 'POST', '/api/notes/n1/restore', undefined],
    ['archived', () => service.archived(), 'GET', '/api/notes/archived', undefined],
    [
      'linkSuggestions',
      () => service.linkSuggestions('run', 'n1'),
      'GET',
      '/api/notes/links?q=run&exclude=n1',
      undefined,
    ],
    [
      'parentOptions',
      () => service.parentOptions('n1', 'play'),
      'GET',
      '/api/notes/n1/parent-options?q=play',
      undefined,
    ],
    ['members', () => service.members('dan'), 'GET', '/api/notes/members?q=dan', undefined],
  ])('%s', (_name, call, method, url, body) => {
    (call() as Observable<unknown>).subscribe();

    const req = controller.expectOne(url);
    expect(req.request.method).toBe(method);
    if (body !== undefined) expect(req.request.body).toEqual(body);
    req.flush(null);
  });

  it('uploads an image as multipart and reads it back as a blob', () => {
    service.uploadImage('n1', new File(['png'], 'whiteboard.png')).subscribe();
    const upload = controller.expectOne('/api/notes/n1/images');
    expect(upload.request.method).toBe('POST');
    expect((upload.request.body as FormData).get('file')).toBeInstanceOf(File);
    upload.flush({ imageId: 'i1' });

    let blob: Blob | undefined;
    service.image('n1', 'i1').subscribe((b) => (blob = b));
    const read = controller.expectOne('/api/notes/n1/images/i1');
    expect(read.request.responseType).toBe('blob');
    read.flush(new Blob(['png']));
    expect(blob).toBeInstanceOf(Blob);
  });
});
