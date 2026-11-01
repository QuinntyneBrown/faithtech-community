import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  ADMIN_USERS_SERVICE,
  AGILE_SERVICE,
  AdminUserSummary,
  AdminUsersService,
  PagedResult,
  WorkspaceSummaryDto,
  ORGANISATION_SERVICE,
} from '@faithtech-community/api';
import { avatarColorFor, DialogService } from '@faithtech-community/components';
import { Observable, of, Subject, throwError } from 'rxjs';

import { SuspendUserDialog } from '../../dialogs';
import { AdminUsersPage } from './admin-users.page';

const grace: AdminUserSummary = {
  id: 'p1',
  name: 'Grace Okonkwo',
  email: 'grace@example.org',
  roles: ['CityLead'],
  status: 'Active',
};
const victor: AdminUserSummary = {
  id: 'p2',
  name: 'Victor Kane',
  email: 'victor@example.org',
  roles: [],
  status: 'Suspended',
};

function page(items: AdminUserSummary[], totalCount = items.length): PagedResult<AdminUserSummary> {
  return { items, page: 1, pageSize: 25, totalCount };
}

async function setup(
  search: (term: string, page?: number) => Observable<PagedResult<AdminUserSummary>>,
  dialogResult: boolean | undefined = true,
  workspaces: Partial<WorkspaceSummaryDto>[] = [],
) {
  const agile = { listWorkspaces: vi.fn(() => of(workspaces as WorkspaceSummaryDto[])) };
  const service = {
    search: vi.fn(search),
    suspend: vi.fn(() => of(undefined)),
    reinstate: vi.fn(() => of(undefined)),
  } satisfies AdminUsersService;
  const dialogs = { open: vi.fn(() => ({ closed: of(dialogResult) })) };
  TestBed.configureTestingModule({
    providers: [
      // The FaithTech seed's names for the role keys (L2-151).
      {
        provide: ORGANISATION_SERVICE,
        useValue: {
          get: () =>
            of({
              roles: [
                {
                  id: 'role-CityLead',
                  key: 'CityLead',
                  name: 'City Lead',
                  description: '',
                  chapterScopable: false,
                },
                {
                  id: 'role-EventLead',
                  key: 'EventLead',
                  name: 'Event Lead',
                  description: '',
                  chapterScopable: false,
                },
                {
                  id: 'role-CreateLead',
                  key: 'CreateLead',
                  name: 'Create Lead',
                  description: '',
                  chapterScopable: false,
                },
                {
                  id: 'role-CommunicationsLead',
                  key: 'CommunicationsLead',
                  name: 'Communications Lead',
                  description: '',
                  chapterScopable: false,
                },
                {
                  id: 'role-Staff',
                  key: 'Staff',
                  name: 'Staff',
                  description: '',
                  chapterScopable: false,
                },
                {
                  id: 'role-Volunteer',
                  key: 'Volunteer',
                  name: 'Volunteer',
                  description: '',
                  chapterScopable: false,
                },
                {
                  id: 'role-ProductEngineer',
                  key: 'ProductEngineer',
                  name: 'Product Engineer',
                  description: '',
                  chapterScopable: false,
                },
                {
                  id: 'role-Attendee',
                  key: 'Attendee',
                  name: 'Attendee',
                  description: '',
                  chapterScopable: false,
                },
                {
                  id: 'role-SystemAdmin',
                  key: 'SystemAdmin',
                  name: 'System Admin',
                  description: '',
                  chapterScopable: false,
                },
              ],
            }),
        },
      },
      { provide: ADMIN_USERS_SERVICE, useValue: service },
      { provide: AGILE_SERVICE, useValue: agile },
      { provide: DialogService, useValue: dialogs },
    ],
  });
  const fixture = TestBed.createComponent(AdminUsersPage);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(host.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label,
    );
  const row = (name: string) =>
    Array.from(host.querySelectorAll('tbody tr')).find((r) => r.textContent?.includes(name))!;
  return { fixture, host, service, dialogs, button, row, settle };
}

describe('AdminUsersPage', () => {
  // L2-040: only the newest search may fill the table (responses can arrive out of order).
  describe('out-of-order responses', () => {
    const many = (prefix: string) =>
      Array.from({ length: 25 }, (_, i) => ({
        ...grace,
        id: `${prefix}${i}`,
        name: `${prefix} ${i}`,
      }));

    function controlled() {
      const pending = new Map<string, Subject<PagedResult<AdminUserSummary>>>();
      const search = (term: string, p = 1) => {
        const s = new Subject<PagedResult<AdminUserSummary>>();
        pending.set(`${term}:${p}`, s);
        return s.asObservable();
      };
      const reply = (key: string, result: PagedResult<AdminUserSummary> | HttpErrorResponse) => {
        const s = pending.get(key)!;
        if (result instanceof HttpErrorResponse) s.error(result);
        else {
          s.next(result);
          s.complete();
        }
      };
      return { search, reply };
    }

    async function searchFor(host: HTMLElement, term: string, settle: () => Promise<void>) {
      const input = host.querySelector<HTMLInputElement>('input[type="search"]')!;
      input.value = term;
      input.dispatchEvent(new Event('input'));
      host.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle();
    }

    it('keeps the newest search when an older one answers last', async () => {
      const api = controlled();
      const { host, settle } = await setup(api.search);
      api.reply(':1', page([grace]));
      await settle();

      await searchFor(host, 'alpha', settle);
      await searchFor(host, 'beta', settle);
      api.reply('beta:1', page([victor]));
      await settle();
      api.reply('alpha:1', page(many('Alpha'), 40));
      await settle();

      const rows = Array.from(host.querySelectorAll('tbody tr')).map((r) => r.textContent);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toContain('Victor Kane');
      expect(host.querySelector<HTMLInputElement>('input[type="search"]')!.value).toBe('beta');
      expect(host.textContent).not.toContain('Show more users');
    });

    it('drops a show-more that was pending when a new search started', async () => {
      const api = controlled();
      const { host, button, settle } = await setup(api.search);
      api.reply(':1', page(many('All'), 60));
      await settle();

      button('Show more users')!.click();
      await settle();
      await searchFor(host, 'beta', settle);
      api.reply('beta:1', page([victor]));
      await settle();
      api.reply(':2', { ...page(many('More'), 60), page: 2 });
      await settle();

      const rows = Array.from(host.querySelectorAll('tbody tr')).map((r) => r.textContent);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toContain('Victor Kane');
      expect(host.textContent).not.toContain('Show more users');
    });

    it('does not let an older failure replace the newest results', async () => {
      const api = controlled();
      const { host, settle } = await setup(api.search);
      api.reply(':1', page([grace]));
      await settle();

      await searchFor(host, 'alpha', settle);
      await searchFor(host, 'beta', settle);
      api.reply('beta:1', page([victor]));
      await settle();
      api.reply('alpha:1', new HttpErrorResponse({ status: 500 }));
      await settle();

      expect(host.textContent).toContain('Victor Kane');
      expect(host.textContent).not.toContain('We couldn’t load users');
    });
  });

  it('flags each live workspace whose owner lost City Lead, linking to its settings (L2-037 AC2)', async () => {
    const { host } = await setup(() => of(page([grace])), true, [
      {
        id: 'w1',
        name: 'Toronto team',
        ownerName: 'Grace Okonkwo',
        needsNewOwner: true,
        isArchived: false,
      },
      {
        id: 'w2',
        name: 'Hackathon ops',
        ownerName: 'Joel Mbeki',
        needsNewOwner: false,
        isArchived: false,
      },
      {
        id: 'w3',
        name: 'Old team',
        ownerName: 'Esther Nakamura',
        needsNewOwner: true,
        isArchived: true,
      },
    ]);

    const alerts = Array.from(host.querySelectorAll('ft-alert'));
    expect(alerts.length).toBe(1);
    expect(alerts[0].textContent).toContain('A workspace needs a new owner');
    expect(alerts[0].textContent).toContain(
      'Grace Okonkwo no longer holds the City Lead role but owns Toronto team.',
    );
    expect(alerts[0].querySelector('a')?.getAttribute('href')).toBe('/workspaces/w1/settings');
  });

  it('lists users with their roles and status, linking each to the profile', async () => {
    const { host, row } = await setup(() => of(page([grace, victor])));

    expect(host.querySelector('h1')!.textContent).toContain('Admin');
    const cells = Array.from(row('Grace Okonkwo').querySelectorAll('td')).map((c) =>
      c.textContent!.trim(),
    );
    expect(cells[0]).toContain('Grace Okonkwo');
    expect(cells.slice(1, 4)).toEqual(['grace@example.org', 'City Lead', 'Active']);
    expect(row('Grace Okonkwo').querySelector('a')!.getAttribute('href')).toBe('/people/p1');
    expect(row('Victor Kane').textContent).toContain('No role');
    expect(row('Victor Kane').textContent).toContain('Suspended');
  });

  it('offers only the Admin sections that share this tab row: Users and Audit log', async () => {
    const { host } = await setup(() => of(page([grace])));

    const nav = host.querySelector('nav[aria-label="Admin sections"]')!;
    const tabs = Array.from(nav.querySelectorAll('a')).map((a) => [
      a.textContent!.trim(),
      a.getAttribute('href'),
      a.getAttribute('aria-current'),
    ]);
    expect(tabs).toEqual([
      ['Users', '/admin/users', 'page'],
      ['Audit log', '/admin/audit-log', null],
    ]);
  });

  it('colours each member’s avatar by their profile id, and a suspended account’s plain', async () => {
    const { row } = await setup(() => of(page([grace, victor])));
    const avatar = (name: string) => row(name).querySelector('.ft-avatar')!;
    expect(avatar('Grace Okonkwo').classList).toContain(`ft-avatar--${avatarColorFor('p1')}`);
    expect(avatar('Victor Kane').classList).toContain('ft-avatar--plain');
  });

  it('searches by name or email and offers to clear an empty search', async () => {
    const { host, service, button, settle } = await setup((term) => of(page(term ? [] : [grace])));
    const input = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = 'qwerty';
    input.dispatchEvent(new Event('input'));
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    expect(service.search).toHaveBeenLastCalledWith('qwerty', 1);
    expect(host.textContent).toContain('No users match “qwerty”');

    button('Clear search')!.click();
    await settle();
    expect(service.search).toHaveBeenLastCalledWith('', 1);
    expect(host.textContent).toContain('Grace Okonkwo');
  });

  it('suspends through the dialog and shows the new status', async () => {
    const { dialogs, button, row, settle } = await setup(() => of(page([grace])));

    button('Suspend Grace Okonkwo')!.click();
    await settle();

    expect(dialogs.open).toHaveBeenCalledWith(SuspendUserDialog, {
      data: { id: 'p1', name: 'Grace Okonkwo' },
    });
    expect(row('Grace Okonkwo').textContent).toContain('Suspended');
    expect(button('Reinstate Grace Okonkwo')).toBeDefined();
  });

  it('reinstates a suspended user', async () => {
    const { service, button, row, settle } = await setup(() => of(page([victor])));

    button('Reinstate Victor Kane')!.click();
    await settle();

    expect(service.reinstate).toHaveBeenCalledWith('p2');
    expect(row('Victor Kane').textContent).toContain('Active');
  });

  it('loads more users 25 at a time', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ ...grace, id: `p${i}`, name: `M ${i}` }));
    const { host, service, button, settle } = await setup((_t, p = 1) =>
      of(p === 1 ? page(many, 26) : { ...page([victor], 26), page: 2 }),
    );

    button('Show more users')!.click();
    await settle();

    expect(service.search).toHaveBeenLastCalledWith('', 2);
    expect(host.querySelectorAll('tbody tr').length).toBe(26);
  });

  it('tells a failure apart from a forbidden caller', async () => {
    const failed = await setup(() => throwError(() => new HttpErrorResponse({ status: 500 })));
    expect(failed.host.textContent).toContain('We couldn’t load users');
    TestBed.resetTestingModule();

    const forbidden = await setup(() => throwError(() => new HttpErrorResponse({ status: 403 })));
    expect(forbidden.host.textContent).toContain('This area is for System Admins');
  });
});
