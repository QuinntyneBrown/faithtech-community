import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StickerPickerComponent, StickerValue } from './sticker-picker.component';

@Component({
  imports: [StickerPickerComponent],
  template: `<ft-sticker-picker
    label="Your vote"
    [(value)]="value"
    [disabled]="disabled()"
    [invalid]="invalid()"
  />`,
})
class HostComponent {
  value = signal<StickerValue | null>(null);
  disabled = signal(false);
  invalid = signal(false);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const cards = () => Array.from(host.querySelectorAll<HTMLButtonElement>('button.sticker-choice'));
  return { fixture, host, cards };
}

describe('StickerPickerComponent', () => {
  it('is a labelled group of eight cards: 1 2 3 5 8 13 21 and ?', () => {
    const { host, cards } = setup();
    const group = host.querySelector('[role="group"]') as HTMLElement;
    const label = host.querySelector('.sticker-picker__label') as HTMLElement;
    expect(group.getAttribute('aria-labelledby')).toBe(label.id);
    expect(label.textContent).toContain('Your vote');
    expect(cards().map((c) => c.querySelector('.sticker-choice__value')?.textContent)).toEqual([
      '1',
      '2',
      '3',
      '5',
      '8',
      '13',
      '21',
      '?',
    ]);
    expect(cards()[0].textContent).toContain('points');
    expect(cards()[7].textContent).toContain('Unsure');
  });

  it('presses one card at a time and releases the others', () => {
    const { fixture, cards } = setup();
    cards()[3].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(5);
    cards()[4].click();
    fixture.detectChanges();
    expect(cards().map((c) => c.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'false',
      'false',
      'true',
      'false',
      'false',
      'false',
    ]);
  });

  it('withdraws the vote when the pressed card is pressed again', () => {
    const { fixture, cards } = setup();
    cards()[2].click();
    cards()[2].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('selects the Unsure card as "?"', () => {
    const { fixture, cards } = setup();
    cards()[7].click();
    expect(fixture.componentInstance.value()).toBe('?');
  });

  it('locks the deck when disabled while keeping the pressed card', () => {
    const { fixture, cards } = setup();
    cards()[1].click();
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    expect(cards().every((c) => c.disabled)).toBe(true);
    expect(cards()[1].getAttribute('aria-pressed')).toBe('true');
    cards()[0].click();
    expect(fixture.componentInstance.value()).toBe(2);
  });

  it('flags an invalid vote on the group', () => {
    const { fixture, host } = setup();
    fixture.componentInstance.invalid.set(true);
    fixture.detectChanges();
    expect(host.querySelector('[role="group"]')?.getAttribute('aria-invalid')).toBe('true');
  });
});
