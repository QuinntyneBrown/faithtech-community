import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AvatarColor, AvatarComponent, AvatarSize } from './avatar.component';

@Component({
  imports: [AvatarComponent],
  template: `<ft-avatar
    [name]="name()"
    [color]="color()"
    [size]="size()"
    [href]="href()"
    [label]="label()"
    [src]="src()"
  />`,
})
class HostComponent {
  name = signal('Grace Okonkwo');
  color = signal<AvatarColor>('plain');
  size = signal<AvatarSize>('md');
  href = signal<string | null>(null);
  label = signal<string | null>(null);
  src = signal<string | null>(null);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const q = <T extends Element>(s: string) => fixture.nativeElement.querySelector(s) as T;
  return { fixture, cmp: fixture.componentInstance, q };
}

describe('AvatarComponent', () => {
  it('shows a decorative photo over the initials when src is set', () => {
    const { fixture, cmp, q } = setup();
    expect(q('.ft-avatar img')).toBeNull();

    cmp.src.set('https://photos.example/grace.jpg');
    fixture.detectChanges();

    const img = q<HTMLImageElement>('.ft-avatar img.ft-avatar__img');
    expect(img.getAttribute('src')).toBe('https://photos.example/grace.jpg');
    expect(img.getAttribute('alt')).toBe('');
    expect(q('.ft-avatar').textContent?.trim()).toBe('GO');
  });

  it('falls back to the initials when the photo fails to load', () => {
    const { fixture, cmp, q } = setup();
    cmp.src.set('https://photos.example/missing.jpg');
    fixture.detectChanges();

    q('.ft-avatar img').dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(q('.ft-avatar img')).toBeNull();
    expect(q('.ft-avatar').textContent?.trim()).toBe('GO');
  });

  it('shows first and last initials in capitals', () => {
    const { q } = setup();
    expect(q('.ft-avatar').textContent?.trim()).toBe('GO');
  });

  it.each([
    ['Tomas Ortega', 'TO'],
    ['madonna', 'M'],
    ['  mary jane watson ', 'MW'],
    ['', ''],
  ])('derives initials for "%s" as "%s"', (name, initials) => {
    const { fixture, cmp, q } = setup();
    cmp.name.set(name);
    fixture.detectChanges();
    expect(q('.ft-avatar').textContent?.trim()).toBe(initials);
  });

  it('is hidden from assistive technology because the name is printed beside it', () => {
    const { q } = setup();
    expect(q('.ft-avatar').getAttribute('aria-hidden')).toBe('true');
  });

  it.each(['plain', 'sky', 'sun', 'lilac', 'sage', 'rose', 'mint', 'peach'] as const)(
    'applies the %s colour',
    (c) => {
      const { fixture, cmp, q } = setup();
      cmp.color.set(c);
      fixture.detectChanges();
      expect(q('.ft-avatar').classList.contains(`ft-avatar--${c}`)).toBe(true);
    },
  );

  it.each(['sm', 'md', 'lg', 'xl'] as const)('applies the %s size', (s) => {
    const { fixture, cmp, q } = setup();
    cmp.size.set(s);
    fixture.detectChanges();
    expect(q('.ft-avatar').classList.contains(`ft-avatar--${s}`)).toBe(true);
  });

  it('becomes a labelled link trigger when href is set', () => {
    const { fixture, cmp, q } = setup();
    cmp.href.set('/profile/me');
    cmp.label.set('Your profile, Grace Okonkwo');
    fixture.detectChanges();
    const a = q<HTMLAnchorElement>('a');
    expect(a.getAttribute('href')).toBe('/profile/me');
    expect(a.getAttribute('aria-label')).toBe('Your profile, Grace Okonkwo');
    expect(a.querySelector('.ft-avatar')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws the link trigger’s initials instead of writing them, so its name is only the label', () => {
    const { fixture, cmp, q } = setup();
    cmp.href.set('/people/me');
    cmp.label.set('Your profile, Grace Okonkwo');
    fixture.detectChanges();
    const circle = q('a .ft-avatar');
    expect(circle.textContent?.trim()).toBe('');
    expect(circle.getAttribute('data-initials')).toBe('GO');
  });

  it('is not a link without href', () => {
    const { q } = setup();
    expect(q('a')).toBeNull();
  });
});
