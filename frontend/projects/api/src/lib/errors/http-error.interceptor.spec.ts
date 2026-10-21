/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/platform/error-and-system-pages
 */
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { HANDLES_FORBIDDEN, httpErrorInterceptor } from './http-error.interceptor';
import { problemDetails } from './problem-details';

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    navigate = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  it('sends 403 to the forbidden page and still surfaces the error', () => {
    let status = 0;
    http.get('/api/x').subscribe({ error: (e) => (status = e.status) });

    controller.expectOne('/api/x').flush({}, { status: 403, statusText: 'Forbidden' });

    expect(navigate).toHaveBeenCalledWith(['/forbidden']);
    expect(status).toBe(403);
  });

  it('leaves 403 to a caller that shows its own forbidden state', () => {
    let status = 0;
    http
      .get('/api/x', { context: new HttpContext().set(HANDLES_FORBIDDEN, true) })
      .subscribe({ error: (e) => (status = e.status) });

    controller.expectOne('/api/x').flush({}, { status: 403, statusText: 'Forbidden' });

    expect(navigate).not.toHaveBeenCalled();
    expect(status).toBe(403);
  });

  it('sends 500 to the error page with the correlation id as reference', () => {
    http.get('/api/x').subscribe({ error: () => undefined });

    controller
      .expectOne('/api/x')
      .flush(
        {},
        { status: 500, statusText: 'Server Error', headers: { 'X-Correlation-ID': 'abc-123' } },
      );

    expect(navigate).toHaveBeenCalledWith(['/error'], { state: { referenceId: 'abc-123' } });
  });

  it.each([400, 404, 409, 429])('leaves %i to the calling page', (code) => {
    http.get('/api/x').subscribe({ error: () => undefined });

    controller.expectOne('/api/x').flush({}, { status: code, statusText: 'x' });

    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('problemDetails', () => {
  it('returns the problem body of an HTTP error response', () => {
    const err = { status: 400, error: { title: 'Invalid', errors: { name: ['Required'] } } };

    expect(problemDetails(err)?.errors).toEqual({ name: ['Required'] });
  });

  it('returns null for anything else', () => {
    expect(problemDetails(new Error('boom'))).toBeNull();
  });
});
