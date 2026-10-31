import { HttpTestingController } from '@angular/common/http/testing';
import { HttpEventType } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { apiTestProviders } from '../shared/api-test-providers';
import { HttpResourcesService } from './http-resources.service';
import {
  RESOURCES_SERVICE,
  ResourceDto,
  ResourceFields,
  ResourceUploadEvent,
} from './resources.service';

const fields: ResourceFields = {
  title: 'City launch deck',
  type: 'deck',
  tags: ['launch', 'brand'],
  visibility: 'Shared',
  memberIds: ['p2'],
  roles: ['Volunteer'],
};

describe('HttpResourcesService', () => {
  let service: HttpResourcesService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: RESOURCES_SERVICE, useClass: HttpResourcesService },
      ],
    });
    service = TestBed.inject(RESOURCES_SERVICE) as HttpResourcesService;
    controller = TestBed.inject(HttpTestingController);
  });

  it.each([
    ['list', () => service.list({}), 'GET', '/api/resources', undefined],
    [
      'list filtered',
      () => service.list({ q: 'deck', type: 'deck', tag: 'launch', page: 2 }),
      'GET',
      '/api/resources?q=deck&type=deck&tag=launch&page=2',
      undefined,
    ],
    ['tags', () => service.tags('lau'), 'GET', '/api/resources/tags?q=lau', undefined],
    ['get', () => service.get('r1'), 'GET', '/api/resources/r1', undefined],
    [
      'addLink',
      () => service.addLink({ ...fields, url: 'https://canva.com' }),
      'POST',
      '/api/resources/links',
      { ...fields, url: 'https://canva.com' },
    ],
    ['update', () => service.update('r1', fields), 'PUT', '/api/resources/r1', fields],
    ['archive', () => service.archive('r1'), 'POST', '/api/resources/r1/archive', undefined],
    ['restore', () => service.restore('r1'), 'POST', '/api/resources/r1/restore', undefined],
    ['archived', () => service.archived(), 'GET', '/api/resources/archived', undefined],
    ['members', () => service.members('dan'), 'GET', '/api/resources/members?q=dan', undefined],
    [
      'ownerCandidates',
      () => service.ownerCandidates('m'),
      'GET',
      '/api/resources/owner-candidates?q=m',
      undefined,
    ],
    [
      'transferOwner',
      () => service.transferOwner('r1', 'p9'),
      'PUT',
      '/api/resources/r1/owner',
      { ownerId: 'p9' },
    ],
  ])('%s', (_name, call, method, url, body) => {
    (call() as Observable<unknown>).subscribe();

    const req = controller.expectOne(url);
    expect(req.request.method).toBe(method);
    if (body !== undefined) expect(req.request.body).toEqual(body);
    req.flush(null);
  });

  it('downloads the file as a blob with the member’s token', () => {
    let blob: Blob | undefined;
    service.download('r1').subscribe((b) => (blob = b));

    const req = controller.expectOne('/api/resources/r1/file');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF']));
    expect(blob).toBeInstanceOf(Blob);
  });

  it('uploads one file as multipart with every field, reporting progress then the resource', () => {
    const events: ResourceUploadEvent[] = [];
    const file = new File(['deck'], 'city-launch-deck.pptx');
    service.upload(file, fields).subscribe((e) => events.push(e));

    const req = controller.expectOne('/api/resources');
    const form = req.request.body as FormData;
    expect(form.get('files')).toBeInstanceOf(File);
    expect([form.get('title'), form.get('type'), form.get('visibility')]).toEqual([
      'City launch deck',
      'deck',
      'Shared',
    ]);
    expect(form.getAll('tags')).toEqual(['launch', 'brand']);
    expect(form.getAll('memberIds')).toEqual(['p2']);
    expect(form.getAll('roles')).toEqual(['Volunteer']);
    req.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 });
    const resource = { id: 'r1' } as ResourceDto;
    req.flush([resource]);
    expect(events).toEqual([
      { kind: 'progress', percent: 50 },
      { kind: 'done', resource },
    ]);
  });

  it('replaces a file in place', () => {
    service.replaceFile('r1', new File(['x'], 'v2.pdf')).subscribe();

    const req = controller.expectOne('/api/resources/r1/file');
    expect(req.request.method).toBe('PUT');
    expect((req.request.body as FormData).get('files')).toBeInstanceOf(File);
  });
});
