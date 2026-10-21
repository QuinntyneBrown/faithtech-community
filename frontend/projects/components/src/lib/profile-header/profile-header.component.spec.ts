import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProfileHeaderComponent, ProfilePhoto } from './profile-header.component';

@Component({
  imports: [ProfileHeaderComponent],
  template: `<ft-profile-header
    name="Samuel Mensah"
    [roles]="roles()"
    location="Toronto"
    memberSince="March 2024"
    [bio]="bio()"
    avatarColor="mint"
    [photoUrl]="photoUrl()"
    [photos]="photos()"
    [loading]="loading()"
  >
    <a actions href="/profiles/samuel-mensah/roles/new">Add a role</a>
    <a actions href="mailto:samuel@example.org">Message by email</a>
  </ft-profile-header>`,
})
class HostComponent {
  roles = signal<string[]>(['City Lead', 'Product Engineer']);
  bio = signal('Backend engineer.');
  photoUrl = signal<string | null>(null);
  photos = signal<ProfilePhoto[]>([]);
  loading = signal(false);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const q = <T extends Element>(s: string) => host.querySelector<T>(s);
  return { fixture, cmp: fixture.componentInstance, host, q };
}

describe('ProfileHeaderComponent', () => {
  it('uses the member name as the page heading', () => {
    const { host } = setup();
    const h1 = host.querySelectorAll('h1');
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent!.trim()).toBe('Samuel Mensah');
  });

  it('shows initials on the avatar, hidden from assistive technology', () => {
    const { q } = setup();
    const avatar = q('.ft-avatar')!;
    expect(avatar.textContent!.trim()).toBe('SM');
    expect(avatar.getAttribute('aria-hidden')).toBe('true');
    expect(avatar.classList.contains('ft-avatar--xl')).toBe(true);
    expect(avatar.classList.contains('ft-avatar--mint')).toBe(true);
  });

  it('shows the featured photo instead of initials when there is one', () => {
    const { fixture, cmp, q } = setup();
    cmp.photoUrl.set('/featured.jpg');
    fixture.detectChanges();
    expect(q('img')!.getAttribute('src')).toBe('/featured.jpg');
  });

  it('shows one role badge per role', () => {
    const { host } = setup();
    const roles = Array.from(host.querySelectorAll('.ft-badge--role')).map((b) =>
      b.textContent!.trim(),
    );
    expect(roles).toEqual(['City Lead', 'Product Engineer']);
  });

  it('says "No role yet" in words when the member has no role', () => {
    const { fixture, cmp, host } = setup();
    cmp.roles.set([]);
    fixture.detectChanges();
    expect(host.querySelector('.ft-badge--role')).toBeNull();
    expect(host.textContent).toContain('No role yet');
  });

  it('prints the city and join date as text', () => {
    const { host } = setup();
    expect(host.textContent).toContain('Toronto · Member since March 2024');
  });

  it('projects the actions the viewer is allowed, in order', () => {
    const { host } = setup();
    expect(Array.from(host.querySelectorAll('a')).map((a) => a.textContent!.trim())).toEqual([
      'Add a role',
      'Message by email',
    ]);
  });

  it('shows the bio, or a muted prompt when there is none', () => {
    const { fixture, cmp, host } = setup();
    expect(host.textContent).toContain('Backend engineer.');
    cmp.bio.set('');
    fixture.detectChanges();
    expect(host.textContent).toContain('You haven’t written a bio yet.');
  });

  it('lists photos under a Photos heading using their alt text', () => {
    const { fixture, cmp, host } = setup();
    expect(host.querySelector('ul')).toBeNull();
    cmp.photos.set([{ url: '/a.jpg', alt: 'Grace speaking' }]);
    fixture.detectChanges();
    expect(host.querySelector('h2')!.textContent!.trim()).toBe('Photos');
    expect(host.querySelector('li img')!.getAttribute('alt')).toBe('Grace speaking');
  });

  it('is busy and shows skeletons while loading, without a heading', () => {
    const { fixture, cmp, host, q } = setup();
    cmp.loading.set(true);
    fixture.detectChanges();
    expect(q('[aria-busy="true"]')).not.toBeNull();
    expect(host.querySelector('ft-skeleton')).not.toBeNull();
    expect(host.querySelector('h1')).toBeNull();
  });
});
