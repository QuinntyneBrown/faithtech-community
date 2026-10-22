import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { HANDLES_FORBIDDEN, HANDLES_SERVER_ERROR } from '../errors';
import { apiTestProviders } from '../shared/api-test-providers';
import { CHECK_IN_SERVICE } from './check-in.service';
import { HttpCheckInService } from './http-check-in.service';

describe('HttpCheckInService', () => {
  let service: HttpCheckInService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: CHECK_IN_SERVICE, useClass: HttpCheckInService },
      ],
    });
    service = TestBed.inject(CHECK_IN_SERVICE) as HttpCheckInService;
    controller = TestBed.inject(HttpTestingController);
  });

  it.each([
    ['getCheckIn', () => service.getCheckIn('e1'), 'GET', '/api/events/e1/check-in'],
    ['checkIn', () => service.checkIn('e1', 'r1'), 'PUT', '/api/events/e1/check-ins/r1'],
    ['undoCheckIn', () => service.undoCheckIn('e1', 'r1'), 'DELETE', '/api/events/e1/check-ins/r1'],
  ])('%s', (_name, call, method, url) => {
    (call() as Observable<unknown>).subscribe();

    const req = controller.expectOne(url);
    expect(req.request.method).toBe(method);
    req.flush(null);
  });

  it('downloads the attendance CSV as a blob, leaving failures to the page', () => {
    service.exportAttendance('e1').subscribe();

    const req = controller.expectOne('/api/events/e1/check-ins.csv');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.context.get(HANDLES_SERVER_ERROR)).toBe(true);
    req.flush(new Blob(['csv']));
  });

  it('adds a walk-in, leaving a failed save to the dialog', () => {
    const request = { name: 'Mira Chen', email: null, checkInNow: true };
    service.addWalkIn('e1', request).subscribe();

    const req = controller.expectOne('/api/events/e1/walk-ins');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    expect(req.request.context.get(HANDLES_SERVER_ERROR)).toBe(true);
    req.flush(null);
  });

  // The page shows its own forbidden state, and a failed save reverts the switch instead of leaving the page.
  it('leaves 403 on the list and failed saves to the page', () => {
    service.getCheckIn('e1').subscribe();
    service.checkIn('e1', 'r1').subscribe();
    service.undoCheckIn('e1', 'r1').subscribe();

    const [get, put, del] = [
      controller.expectOne({ method: 'GET' }),
      controller.expectOne({ method: 'PUT' }),
      controller.expectOne({ method: 'DELETE' }),
    ];
    expect(get.request.context.get(HANDLES_FORBIDDEN)).toBe(true);
    for (const write of [put, del]) {
      expect(write.request.context.get(HANDLES_SERVER_ERROR)).toBe(true);
      write.flush(null);
    }
    get.flush(null);
  });
});
