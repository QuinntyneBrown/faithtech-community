import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  AUDIT_LOG_SERVICE,
  AuditEntry,
  AuditFilters,
  AuditLogService,
  PagedResult,
} from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { AuditLogPage } from './audit-log.page';

function entry(summary: string, id = summary): AuditEntry {
  return {
    id,
    occurredAtUtc: '2026-10-21T10:05:00Z',
    actorId: 'p1',
    actorName: 'Priya Shah',
    action: 'role.granted',
    targetType: 'Profile',
    targetId: 'p2',
    summary,
    before: null,
    after: null,
    ipAddress: '10.0.0.1',
  };
}

function page(items: AuditEntry[], totalCount = items.length, pageNo = 1): PagedResult<AuditEntry> {
  return { items, page: pageNo, pageSize: 50, totalCount };
}

async function setup(
  getEntries: (filters: AuditFilters, page?: number) => Observable<PagedResult<AuditEntry>>,
) {
  const service = {
    getEntries: vi.fn(getEntries),
    exportCsv: vi.fn(() => of(new Blob(['x']))),
  } satisfies AuditLogService;
  TestBed.configureTestingModule({
    providers: [{ provide: AUDIT_LOG_SERVICE, useValue: service }],
  });
  const fixture = TestBed.createComponent(AuditLogPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const button = (name: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes(name));
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, host, service, button, settle };
}

describe('AuditLogPage', () => {
  it('shows when, who and what for each entry', async () => {
    const { host } = await setup(() => of(page([entry('Granted City Lead to Esther Nakamura')])));

    expect(host.querySelector('h1')!.textContent).toContain('Admin');
    const cells = Array.from(host.querySelectorAll('tbody td')).map((td) => td.textContent!.trim());
    expect(cells[0]).toMatch(/^2026-10-2\d \d\d:\d\d$/);
    expect(cells[1]).toBe('Priya Shah');
    expect(cells[2]).toBe('Granted City Lead to Esther Nakamura');
  });

  it('filters by category and says when nothing matches', async () => {
    const { host, service, settle } = await setup((filters) =>
      of(page(filters.category ? [] : [entry('Reinstated Victor Kane')])),
    );
    const select = host.querySelector('select')!;

    select.value = 'suspensions';
    select.dispatchEvent(new Event('change'));
    await settle();

    expect(service.getEntries).toHaveBeenLastCalledWith({ category: 'suspensions' }, 1);
    expect(host.textContent).toContain('No suspensions in the last 90 days');
    expect(host.textContent).toContain('Show all actions');
  });

  it('shows the empty state when nothing has been recorded', async () => {
    const { host } = await setup(() => of(page([])));
    expect(host.textContent).toContain('No admin actions yet');
  });

  it('loads older entries 50 at a time', async () => {
    const first = Array.from({ length: 50 }, (_, i) => entry(`Entry ${i}`));
    const { host, service, button, settle } = await setup((_f, p = 1) =>
      of(p === 1 ? page(first, 51) : page([entry('Entry 50')], 51, 2)),
    );

    button('Show older entries')!.click();
    await settle();

    expect(service.getEntries).toHaveBeenLastCalledWith({ category: null }, 2);
    expect(host.querySelectorAll('tbody tr').length).toBe(51);
    expect(button('Show older entries')).toBeUndefined();
  });

  it('tells a failure apart from a forbidden caller', async () => {
    const failed = await setup(() => throwError(() => new HttpErrorResponse({ status: 500 })));
    expect(failed.host.textContent).toContain('We couldn’t load the audit log');
    TestBed.resetTestingModule();

    const forbidden = await setup(() => throwError(() => new HttpErrorResponse({ status: 403 })));
    expect(forbidden.host.textContent).toContain('This area is for System Admins');
    expect(forbidden.host.textContent).not.toContain('Export CSV');
  });

  it('exports the current filter as CSV', async () => {
    const { service, button } = await setup(() =>
      of(page([entry('Granted Staff to Daniel Reyes')])),
    );
    URL.createObjectURL = vi.fn(() => 'blob:audit');
    URL.revokeObjectURL = vi.fn();

    button('Export CSV')!.click();

    expect(service.exportCsv).toHaveBeenCalledWith({ category: null });
  });
});
