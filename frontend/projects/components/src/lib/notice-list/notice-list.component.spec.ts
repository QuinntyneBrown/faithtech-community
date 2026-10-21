import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Notice, NoticeListComponent, toNotice } from './notice-list.component';

const NOTICES: Notice[] = [
  {
    id: 'n1',
    name: 'Esther Nakamura',
    color: 'mint',
    text: 'Esther Nakamura cancelled',
    linkText: 'Austin Faith & AI Panel',
    href: '/events/austin-panel',
    meta: 'Mon 20 Oct',
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
  imports: [NoticeListComponent],
  template: `<ft-notice-list
    label="Notifications"
    [notices]="notices()"
    (noticeOpened)="opened.push($event)"
  />`,
})
class HostComponent {
  notices = signal<Notice[]>(NOTICES);
  opened: string[] = [];
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const items = () => Array.from(host.querySelectorAll('li'));
  const link = () => host.querySelector<HTMLAnchorElement>('li a')!;
  return { fixture, cmp: fixture.componentInstance, host, items, link };
}

describe('NoticeListComponent', () => {
  it('is a named list of notices, each with its sentence, link and time', () => {
    const { host, items, link } = setup();
    expect(host.querySelector('ul')!.getAttribute('aria-label')).toBe('Notifications');
    expect(items()).toHaveLength(2);
    expect(items()[0].textContent).toContain('Esther Nakamura cancelled');
    expect(link().textContent!.trim()).toBe('Austin Faith & AI Panel');
    expect(link().getAttribute('href')).toBe('/events/austin-panel');
    expect(items()[1].textContent).toContain('Fri 17 Oct');
  });

  it('says Unread in words as well as colour', () => {
    const { items } = setup();
    expect(items()[0].textContent).toContain('Mon 20 Oct · Unread');
    expect(items()[0].classList.contains('ft-notice--unread')).toBe(true);
    expect(items()[1].textContent).not.toContain('Unread');
  });

  it('hides the initials avatars from assistive technology', () => {
    const { host } = setup();
    const avatars = Array.from(host.querySelectorAll('.ft-avatar'));
    expect(avatars.map((a) => a.textContent!.trim())).toEqual(['EN', 'HK']);
    expect(avatars.every((a) => a.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('hands a plain click to the app, which marks the notice read and navigates', () => {
    const { cmp, link } = setup();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link().dispatchEvent(click);
    expect(cmp.opened).toEqual(['n1']);
    expect(click.defaultPrevented).toBe(true);
  });

  it('leaves a click that opens a new tab to the browser', () => {
    const { cmp, link } = setup();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    link().dispatchEvent(click);
    expect(cmp.opened).toEqual([]);
    expect(click.defaultPrevented).toBe(false);
  });

  it('turns a stored notification into a notice whose sentence is the link', () => {
    const now = new Date(2026, 9, 21, 15);
    const record = {
      id: 'n9',
      title: 'Your roles changed',
      linkPath: '/people/me',
      actorName: null,
      createdAt: new Date(2026, 9, 21, 11, 42).toISOString(),
      readAt: null,
    };
    expect(toNotice(record, now)).toEqual({
      id: 'n9',
      name: 'FaithTech',
      text: '',
      linkText: 'Your roles changed',
      href: '/people/me',
      meta: 'Today, 11:42 am',
      unread: true,
    });
    expect(
      toNotice({ ...record, actorName: 'Hannah Kim', readAt: record.createdAt }, now),
    ).toMatchObject({
      name: 'Hannah Kim',
      unread: false,
    });
  });
});
