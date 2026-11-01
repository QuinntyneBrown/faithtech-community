// Traces to: L2-161 AC5 (docs/detailed-designs/events/fill-in-hub-sections)
import { TestBed } from '@angular/core/testing';
import { HubPersonDto } from '@faithtech-community/api';

import { HubPeopleComponent } from './hub-people.component';

const person = (name: string, role: HubPersonDto['role'], line: string | null = null) => ({
  profileId: null,
  name,
  line,
  role,
  photoUrl: null,
});

describe('HubPeopleComponent', () => {
  it('groups people under Speakers, Mentors and Judges and leaves out empty groups', () => {
    const fixture = TestBed.createComponent(HubPeopleComponent);
    fixture.componentRef.setInput('people', [
      person('Samuel Mensah', 'Mentor'),
      person('Nadia Farouk', 'Mentor', 'Founder, Kestrel Labs'),
      person('Hannah Kim', 'Speaker'),
    ]);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const groups = Array.from(host.querySelectorAll('h4')).map((h) => h.textContent?.trim());
    expect(groups).toEqual(['Speakers', 'Mentors']);
    expect(host.textContent).toContain('Founder, Kestrel Labs');
    expect(host.querySelector('[aria-label="Mentors"]')?.textContent).toContain('Nadia Farouk');
  });
});
