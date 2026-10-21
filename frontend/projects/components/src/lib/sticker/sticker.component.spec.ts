import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StickerComponent } from './sticker.component';

@Component({
  imports: [StickerComponent],
  template: `<ft-sticker [size]="size()" [label]="label()" [src]="src()">8</ft-sticker>`,
})
class HostComponent {
  size = signal<'md' | 'lg' | 'xl'>('md');
  label = signal<string | null>(null);
  src = signal<string | null>(null);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const q = <T extends Element>(s: string) => fixture.nativeElement.querySelector(s) as T;
  return { fixture, cmp: fixture.componentInstance, q };
}

describe('StickerComponent', () => {
  it('shows the projected value in a round container', () => {
    const { q } = setup();
    expect(q('.ft-sticker').textContent).toContain('8');
  });

  it('is decorative without a label', () => {
    const { q } = setup();
    expect(q('.ft-sticker').getAttribute('aria-hidden')).toBe('true');
    expect(q('.ft-sticker').getAttribute('role')).toBeNull();
  });

  it('is an image with a full name when labelled', () => {
    const { fixture, cmp, q } = setup();
    cmp.label.set('Grace Okonkwo: 8 points');
    fixture.detectChanges();
    expect(q('.ft-sticker').getAttribute('role')).toBe('img');
    expect(q('.ft-sticker').getAttribute('aria-label')).toBe('Grace Okonkwo: 8 points');
    expect(q('.ft-sticker').hasAttribute('aria-hidden')).toBe(false);
  });

  it.each(['md', 'lg', 'xl'] as const)('applies the %s size', (s) => {
    const { fixture, cmp, q } = setup();
    cmp.size.set(s);
    fixture.detectChanges();
    expect(q('.ft-sticker').classList.contains(`ft-sticker--${s}`)).toBe(true);
  });

  it('overlays a picture when src is set', () => {
    const { fixture, cmp, q } = setup();
    cmp.src.set('/pic.png');
    fixture.detectChanges();
    const img = q<HTMLImageElement>('img');
    expect(img.getAttribute('src')).toBe('/pic.png');
    expect(img.getAttribute('alt')).toBe('');
  });

  it('removes a picture that fails to load, keeping the value', () => {
    const { fixture, cmp, q } = setup();
    cmp.src.set('/broken.png');
    fixture.detectChanges();
    q<HTMLImageElement>('img').dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(q('img')).toBeNull();
    expect(q('.ft-sticker').textContent).toContain('8');
  });
});
