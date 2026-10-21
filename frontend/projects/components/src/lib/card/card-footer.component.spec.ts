import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CardFooterComponent } from './card-footer.component';
import { CardComponent } from './card.component';

@Component({
  imports: [CardComponent, CardFooterComponent],
  template: `<ft-card variant="flush" heading="Coming up">
    <ul class="list"></ul>
    <ft-card-footer><a href="/events">All events</a></ft-card-footer>
  </ft-card>`,
})
class HostComponent {}

describe('CardFooterComponent', () => {
  it('closes a flush card with its link, after the content, as the card footer', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('ft-card') as HTMLElement;
    const footer = card.lastElementChild as HTMLElement;

    expect(footer.tagName.toLowerCase()).toBe('ft-card-footer');
    expect(footer.classList).toContain('ft-card__footer');
    expect(footer.querySelector('a')?.textContent).toBe('All events');
  });
});
