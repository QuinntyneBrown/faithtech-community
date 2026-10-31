import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import {
  AUDIT_LOG_SERVICE,
  AUTH_SERVICE,
  AuditEntry,
  AuditFilters,
  AuditLogService,
  Capability,
  PagedResult,
} from '@faithtech-community/api';
import { ToastService } from '@faithtech-community/components';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';

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
  exportCsv: () => Observable<Blob> = () => of(new Blob(['x'])),
  options: { capabilities?: Capability[]; context?: 'organisation' } = {},
) {
  const service = {
    getEntries: vi.fn(getEntries),
    exportCsv: vi.fn(exportCsv),
  } satisfies AuditLogService;
  const toasts = { show: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: AUDIT_LOG_SERVICE, useValue: service },
      { provide: ToastService, useValue: toasts },
      {
        provide: AUTH_SERVICE,
        useValue: {
          capabilities: signal(options.capabilities ?? ['AdministerOrganisation']),
          currentUser: signal({
            organisation: { chapterLabel: { singular: 'Campus', plural: 'Campuses' } },
          }),
        },
      },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { data: options.context ? { context: options.context } : {} } },
      },
    ],
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
  return { fixture, host, service, toasts, button, settle };
}

describe('AuditLogPage', () => {
  // L2-041: only the newest category may fill the log (responses can arrive out of order).
  describe('out-of-order responses', () => {
    function controlled() {
      const pending = new Map<string, Subject<PagedResult<AuditEntry>>>();
      const getEntries = (filters: AuditFilters, p = 1) => {
        const s = new Subject<PagedResult<AuditEntry>>();
        pending.set(`${filters.category ?? 'all'}:${p}`, s);
        return s.asObservable();
      };
      const reply = (key: string, result: PagedResult<AuditEntry> | HttpErrorResponse) => {
        const s = pending.get(key)!;
        if (result instanceof HttpErrorResponse) s.error(result);
        else {
          s.next(result);
          s.complete();
        }
      };
      return { getEntries, reply };
    }
    const choose = (host: HTMLElement, value: string) => {
      const select = host.querySelector('select')!;
      select.value = value;
      select.dispatchEvent(new Event('change'));
    };
    const rows = (host: HTMLElement) =>
      Array.from(host.querySelectorAll('tbody tr')).map((r) => r.textContent!);

    it('keeps the newest category when an older one answers last', async () => {
      const api = controlled();
      const { host, settle } = await setup(api.getEntries);
      api.reply('all:1', page([entry('Everything')]));
      await settle();

      choose(host, 'roles');
      await settle();
      choose(host, 'suspensions');
      await settle();
      api.reply('suspensions:1', page([], 0));
      await settle();
      api.reply('roles:1', page([entry('Granted Staff to Daniel Reyes')], 80));
      await settle();

      expect(rows(host)).toEqual([]);
      expect(host.textContent).toContain('No suspensions in the last 90 days');
      expect(host.textContent).not.toContain('Show older entries');
    });

    it('drops a show-more that was pending when the category changed', async () => {
      const api = controlled();
      const { host, button, settle } = await setup(api.getEntries);
      const fifty = Array.from({ length: 50 }, (_, i) => entry(`All ${i}`));
      api.reply('all:1', page(fifty, 120));
      await settle();

      button('Show older entries')!.click();
      await settle();
      choose(host, 'suspensions');
      await settle();
      api.reply('suspensions:1', page([entry('Suspended Victor Kane')]));
      await settle();
      api.reply('all:2', page([entry('Late page')], 120, 2));
      await settle();

      expect(rows(host)).toHaveLength(1);
      expect(rows(host)[0]).toContain('Suspended Victor Kane');
    });

    it('does not let an older failure replace the newest entries', async () => {
      const api = controlled();
      const { host, settle } = await setup(api.getEntries);
      api.reply('all:1', page([entry('Everything')]));
      await settle();

      choose(host, 'roles');
      await settle();
      choose(host, 'suspensions');
      await settle();
      api.reply('suspensions:1', page([entry('Suspended Victor Kane')]));
      await settle();
      api.reply('roles:1', new HttpErrorResponse({ status: 500 }));
      await settle();

      expect(host.textContent).toContain('Suspended Victor Kane');
      expect(host.textContent).not.toContain('We couldn’t load');
    });
  });

  it('shows when, who and what for each entry', async () => {
    const { host } = await setup(() => of(page([entry('Granted City Lead to Esther Nakamura')])));

    expect(host.querySelector('h1')!.textContent).toContain('Admin');
    const cells = Array.from(host.querySelectorAll('tbody td')).map((td) => td.textContent!.trim());
    expect(cells[0]).toMatch(/^2026-10-2\d \d\d:\d\d$/);
    expect(cells[1]).toBe('Priya Shah');
    expect(cells[2]).toBe('Granted City Lead to Esther Nakamura');
  });

  it('offers only the Admin sections that share this tab row: Users and Audit log', async () => {
    const { host } = await setup(() => of(page([entry('Granted Staff to Daniel Reyes')])));

    const nav = host.querySelector('nav[aria-label="Admin sections"]')!;
    const tabs = Array.from(nav.querySelectorAll('a')).map((a) => [
      a.textContent!.trim(),
      a.getAttribute('href'),
      a.getAttribute('aria-current'),
    ]);
    expect(tabs).toEqual([
      ['Users', '/admin/users', null],
      ['Audit log', '/admin/audit-log', 'page'],
    ]);
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

  it('shows skeleton table rows under the When, Who and What headers while loading', async () => {
    const { host } = await setup(() => NEVER);

    const table = host.querySelector('table')!;
    expect(table.getAttribute('aria-busy')).toBe('true');
    expect(table.querySelector('caption')!.textContent).toBe('Audit log');
    const headers = Array.from(table.querySelectorAll('th')).map((th) => th.textContent!.trim());
    expect(headers).toEqual(['When', 'Who', 'What']);
    expect(table.querySelectorAll('tbody tr ft-skeleton').length).toBeGreaterThan(0);
    expect(host.querySelector('ft-list-skeleton')).toBeNull();
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

  it('shows Export CSV as busy until the file is ready, then confirms the download', async () => {
    const file = new Subject<Blob>();
    const { host, toasts, settle } = await setup(
      () => of(page([entry('Granted Staff to Daniel Reyes')])),
      () => file,
    );
    URL.createObjectURL = vi.fn(() => 'blob:audit');
    URL.revokeObjectURL = vi.fn();
    const exportButton = () =>
      Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('Export'))!;

    exportButton().click();
    await settle();

    expect(exportButton().getAttribute('aria-busy')).toBe('true');
    expect(exportButton().textContent!.trim()).toBe('Exporting…');

    file.next(new Blob(['x']));
    file.complete();
    await settle();

    expect(exportButton().getAttribute('aria-busy')).toBeNull();
    expect(exportButton().textContent!.trim()).toBe('Export CSV');
    expect(toasts.show).toHaveBeenCalledWith({
      variant: 'success',
      heading: 'Audit log exported',
      text: 'audit-log.csv is in your downloads.',
    });
  });

  it('says so when the export fails and lets the admin try again', async () => {
    const { button, service, toasts, settle } = await setup(
      () => of(page([entry('Granted Staff to Daniel Reyes')])),
      () => throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    button('Export CSV')!.click();
    await settle();

    expect(toasts.show).toHaveBeenCalledWith({
      variant: 'danger',
      heading: 'We couldn’t export the audit log',
      text: 'Check your connection and try again.',
      actionLabel: 'Try again',
      onAction: expect.any(Function),
    });
    expect(button('Export CSV')!.getAttribute('aria-busy')).toBeNull();

    toasts.show.mock.calls[0][0].onAction();
    await settle();
    expect(service.exportCsv).toHaveBeenCalledTimes(2);
  });
  // L2-152 AC2, AC3: the settings categories, and a partial reader sees only theirs.
  describe('settings categories', () => {
    const labels = (host: HTMLElement) =>
      Array.from(host.querySelectorAll('option')).map((o) => o.textContent?.trim());

    it('offers an administrator every category, chapters under the organisation’s label', async () => {
      const { host } = await setup(() => of(page([])));

      expect(labels(host)).toEqual([
        'All actions',
        'Roles',
        'Suspensions',
        'Private contact access',
        'Deletions',
        'Organisation',
        'Campuses',
        'Stages & types',
      ]);
    });

    it('offers a settings manager only theirs, under Organisation rather than Admin', async () => {
      const { host } = await setup(() => of(page([])), undefined, {
        capabilities: ['ManageOrganisationSettings'],
        context: 'organisation',
      });

      expect(labels(host)).toEqual([
        'Everything you can see',
        'Organisation',
        'Campuses',
        'Stages & types',
      ]);
      expect(host.querySelector('h1')?.textContent).toContain('Audit log');
      expect(host.textContent).toContain(
        'You can see the settings you can change: Organisation, Campuses and Stages & types.',
      );
      expect(host.querySelector('ft-tabs')).toBeNull();
      expect(host.querySelector('ft-breadcrumb')?.textContent).toContain('Organisation');
      expect(host.textContent).toContain('No settings changes yet');
    });

    it('offers a roles manager the roles category', async () => {
      const { host } = await setup(() => of(page([])), undefined, {
        capabilities: ['ManageRoles'],
        context: 'organisation',
      });

      expect(labels(host)).toEqual(['Everything you can see', 'Roles']);
    });
  });
});
