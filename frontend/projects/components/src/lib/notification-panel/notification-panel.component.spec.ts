import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Notice, NotificationPanelComponent } from './notification-panel.component';

const NOTICES: Notice[] = [
  {
    id: 'n1',
    name: 'Tomás Ortega',
    color: 'sun',
    text: 'Tomás Ortega signed up — he’s one of your contacts.',
    linkText: 'Link his profile',
    href: '/contacts/tomas-ortega',
    meta: 'Today, 11:42 am',
    unread: true,
  },
  {
    id: 'n2',
    name: 'Hannah Kim',
    text: 'Hannah Kim sent “Builders Night moves to Kestrel Labs”',
    meta: 'Fri 17 Oct',
    unread: false,
  },
];

@Component({
  imports: [NotificationPanelComponent],
  template: `<ft-notification-panel
    [notices]="notices()"
    [limit]="limit()"
    (markAllRead)="markAll = markAll + 1"
    (noticeOpened)="opened.push($event)"
  />`,
})
class HostComponent {
  notices = signal<Notice[]>(NOTICES);
  limit = signal(5);
  markAll = 0;
  opened: string[] = [];
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const q = <T extends Element>(s: string) => host.querySelector<T>(s);
  const all = <T extends Element>(s: string) => Array.from(host.querySelectorAll<T>(s));
  return { fixture, cmp: fixture.componentInstance, host, q, all };
}

describe('NotificationPanelComponent', () => {
  it('is a dialog named Notifications', () => {
    const { q } = setup();
    const panel = q('[role="dialog"]')!;
    expect(panel.getAttribute('aria-label')).toBe('Notifications');
    expect(panel.textContent).toContain('Notifications');
  });

  it('lists each notice with its sentence, link and time', () => {
    const { all, q } = setup();
    expect(all('li')).toHaveLength(2);
    const link = q<HTMLAnchorElement>('li a')!;
    expect(link.textContent!.trim()).toBe('Link his profile');
    expect(link.getAttribute('href')).toBe('/contacts/tomas-ortega');
    expect(all('li')[0].textContent).toContain('Today, 11:42 am');
  });

  it('shows unread in words as well as colour, and not on read notices', () => {
    const { all } = setup();
    expect(all('li')[0].textContent).toContain('Today, 11:42 am · Unread');
    expect(all('li')[0].classList.contains('ft-notice--unread')).toBe(true);
    expect(all('li')[1].textContent).not.toContain('Unread');
    expect(all('li')[1].classList.contains('ft-notice--unread')).toBe(false);
  });

  it('hides the initials avatars from assistive technology', () => {
    const { all } = setup();
    const avatars = all('.ft-avatar');
    expect(avatars.map((a) => a.textContent!.trim())).toEqual(['TO', 'HK']);
    expect(avatars.every((a) => a.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('emits when a notice link is opened', () => {
    const { cmp, q } = setup();
    q<HTMLAnchorElement>('li a')!.addEventListener('click', (e) => e.preventDefault());
    q<HTMLAnchorElement>('li a')!.click();
    expect(cmp.opened).toEqual(['n1']);
  });

  it('marks all read from the header', () => {
    const { cmp, all } = setup();
    all<HTMLButtonElement>('button')
      .find((b) => b.textContent!.includes('Mark all read'))!
      .click();
    expect(cmp.markAll).toBe(1);
  });

  it('shows at most the latest few notices', () => {
    const { fixture, cmp, all } = setup();
    cmp.limit.set(1);
    fixture.detectChanges();
    expect(all('li')).toHaveLength(1);
  });

  it('links to the full page', () => {
    const { all } = setup();
    const see = all<HTMLAnchorElement>('a').find((a) => a.textContent!.trim() === 'See all')!;
    expect(see.getAttribute('href')).toBe('/notifications');
  });

  it('shows a caught-up message and no Mark all read when empty', () => {
    const { fixture, cmp, host, all } = setup();
    cmp.notices.set([]);
    fixture.detectChanges();
    expect(host.textContent).toContain('You’re all caught up');
    expect(host.textContent).toContain('New notifications show up here.');
    expect(all('button').some((b) => b.textContent!.includes('Mark all read'))).toBe(false);
    expect(host.querySelector('li')).toBeNull();
  });

  it('drops Mark all read when nothing is unread', () => {
    const { fixture, cmp, all } = setup();
    cmp.notices.set([NOTICES[1]]);
    fixture.detectChanges();
    expect(all('button').some((b) => b.textContent!.includes('Mark all read'))).toBe(false);
  });
});
