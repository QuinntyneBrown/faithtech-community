import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DescriptionListComponent } from './description-list.component';
import { DescriptionListItemComponent } from './description-list-item.component';

@Component({
  imports: [DescriptionListComponent, DescriptionListItemComponent],
  template: `<ft-description-list>
    <ft-description-list-item label="Email"
      ><a href="mailto:a@b.c">a@b.c</a></ft-description-list-item
    >
    <ft-description-list-item label="Phone">416-555-0142</ft-description-list-item>
  </ft-description-list>`,
})
class HostComponent {}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('DescriptionListComponent', () => {
  it('renders each label as a term and each value as its definition', () => {
    const el = setup();
    const terms = Array.from(el.querySelectorAll('dt')).map((t) => t.textContent?.trim());
    expect(terms).toEqual(['Email', 'Phone']);
    expect(el.querySelectorAll('dd')[1].textContent?.trim()).toBe('416-555-0142');
  });

  it('projects rich values such as links', () => {
    expect(setup().querySelector('dd a')?.getAttribute('href')).toBe('mailto:a@b.c');
  });

  it('groups the items', () => {
    const el = setup();
    expect(el.querySelector('ft-description-list')?.getAttribute('role')).toBe('group');
    expect(el.querySelectorAll('ft-description-list-item').length).toBe(2);
  });

  describe('while loading', () => {
    @Component({
      imports: [DescriptionListComponent, DescriptionListItemComponent],
      template: `<ft-description-list [loading]="true">
        <ft-description-list-item label="Email">a@b.c</ft-description-list-item>
        <ft-description-list-item label="Phone">416-555-0142</ft-description-list-item>
      </ft-description-list>`,
    })
    class LoadingHostComponent {}

    function setupLoading() {
      const fixture = TestBed.createComponent(LoadingHostComponent);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('marks the list busy', () => {
      expect(setupLoading().querySelector('ft-description-list')?.getAttribute('aria-busy')).toBe(
        'true',
      );
    });

    it('keeps every term and shows a skeleton line in place of each value', () => {
      const el = setupLoading();
      const terms = Array.from(el.querySelectorAll('dt')).map((t) => t.textContent?.trim());
      expect(terms).toEqual(['Email', 'Phone']);
      const values = Array.from(el.querySelectorAll('dd'));
      expect(values.every((dd) => dd.querySelector('ft-skeleton'))).toBe(true);
      expect(el.textContent).not.toContain('416-555-0142');
    });
  });

  it('is not busy once loaded', () => {
    expect(setup().querySelector('ft-description-list')?.getAttribute('aria-busy')).toBeNull();
  });
});
