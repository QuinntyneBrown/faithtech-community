import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Notice, NoticeListComponent, noticeSentence } from './notice-list.component';

const NOTICES: Notice[] = [
  {
    id: 'n1',
    name: 'Samuel Mensah',
    color: 'mint',
    text: 'Samuel Mensah assigned you ',
    linkText: 'Shelter problem briefs for teams',
    href: '/workspaces/w1/items/i1',
    meta: 'Today, 9:30 am',
    unread: true,
  },
  {
    id: 'n2',
    name: 'Hannah Kim',
    text: 'Hannah Kim sent an announcement',
    meta: 'Fri 17 Oct',
    unread: false,
  },
];

@Component({
  imports: [NoticeListComponent],
  template: `<ft-notice-list
    [notices]="notices()"
    [deferNavigation]="defer()"
    (noticeOpened)="opened.push($event)"
  />`,
})
class HostComponent {
  notices = signal<Notice[]>(NOTICES);
  defer = signal(false);
  opened: string[] = [];
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const rows = () => Array.from(host.querySelectorAll('li'));
  const link = () => host.querySelector<HTMLAnchorElement>('li a')!;
  return { fixture, cmp: fixture.componentInstance, host, rows, link };
}

describe('NoticeListComponent', () => {
  it('lists each notice with initials, its sentence, its link and the time', () => {
    const { rows, link } = setup();
    expect(rows()).toHaveLength(2);
    expect(rows()[0].querySelector('.ft-avatar')!.textContent!.trim()).toBe('SM');
    expect(rows()[0].textContent).toContain('Samuel Mensah assigned you');
    expect(link().textContent!.trim()).toBe('Shelter problem briefs for teams');
    expect(link().getAttribute('href')).toBe('/workspaces/w1/items/i1');
  });

  it('says Unread in words and tints unread rows', () => {
    const { rows } = setup();
    expect(rows()[0].textContent).toContain('Today, 9:30 am · Unread');
    expect(rows()[0].classList.contains('ft-notice--unread')).toBe(true);
    expect(rows()[1].textContent).not.toContain('Unread');
  });

  it('emits the opened notice and lets the link navigate by default', () => {
    const { cmp, link } = setup();
    let prevented = false;
    link().addEventListener('click', (e) => {
      prevented = e.defaultPrevented;
      e.preventDefault();
    });
    link().click();
    expect(cmp.opened).toEqual(['n1']);
    expect(prevented).toBe(false);
  });

  it('holds the navigation back for the host when deferNavigation is set', () => {
    const { fixture, cmp, link } = setup();
    cmp.defer.set(true);
    fixture.detectChanges();
    let prevented = false;
    // Registered on the document so it runs after the component's own handler.
    const listener = (e: Event) => {
      prevented = e.defaultPrevented;
      e.preventDefault();
    };
    document.addEventListener('click', listener);
    document.body.appendChild(fixture.nativeElement);
    link().click();
    document.removeEventListener('click', listener);
    fixture.nativeElement.remove();
    expect(cmp.opened).toEqual(['n1']);
    expect(prevented).toBe(true);
  });
});

describe('noticeSentence', () => {
  it('links only the phrase that names the item, keeping the sentence around it', () => {
    expect(
      noticeSentence('Austin Faith & AI Panel was cancelled', 'Austin Faith & AI Panel'),
    ).toEqual({ text: '', linkText: 'Austin Faith & AI Panel', after: ' was cancelled' });
    expect(noticeSentence('Grace assigned you Kiosk', 'Kiosk')).toEqual({
      text: 'Grace assigned you ',
      linkText: 'Kiosk',
      after: '',
    });
  });

  it('links the whole sentence when it names no item, or not the given one', () => {
    expect(noticeSentence('Your roles changed', null)).toEqual({
      text: '',
      linkText: 'Your roles changed',
      after: '',
    });
    expect(noticeSentence('Your roles changed', 'Open it').linkText).toBe('Your roles changed');
  });

  it('renders the sentence as one line of text with the link inside it', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.notices.set([
      {
        id: 'n3',
        name: 'Esther Nakamura',
        ...noticeSentence('Austin Faith & AI Panel was cancelled', 'Austin Faith & AI Panel'),
        href: '/events/e1',
        meta: 'Mon 20 Oct',
        unread: false,
      },
    ]);
    fixture.detectChanges();
    const sentence = (fixture.nativeElement as HTMLElement).querySelector('.ft-notice__sentence')!;
    expect(sentence.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'Austin Faith & AI Panel was cancelled',
    );
    expect(sentence.querySelector('a')!.textContent!.trim()).toBe('Austin Faith & AI Panel');
  });
});
