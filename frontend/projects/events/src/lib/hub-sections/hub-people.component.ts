import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HubPersonDto, HubPersonRole } from '@faithtech-community/api';
import {
  AvatarComponent,
  ListComponent,
  ListItemComponent,
  StackComponent,
  avatarColorFor,
} from '@faithtech-community/components';

const GROUPS: readonly { role: HubPersonRole; title: string }[] = [
  { role: 'Speaker', title: 'Speakers' },
  { role: 'Mentor', title: 'Mentors' },
  { role: 'Judge', title: 'Judges' },
];

let next = 0;

/**
 * The People display (L2-161 AC5): people grouped under Speakers, Mentors and Judges, leaving out empty groups, each
 * with a photo (members) or initials (guests) and their line.
 */
@Component({
  selector: 'ft-hub-people',
  imports: [AvatarComponent, ListComponent, ListItemComponent, StackComponent],
  templateUrl: './hub-people.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubPeopleComponent {
  readonly people = input.required<readonly HubPersonDto[]>();

  protected readonly id = `hub-people-${++next}`;
  protected readonly groups = computed(() =>
    GROUPS.map((g) => ({
      ...g,
      people: this.people()
        .filter((p) => p.role === g.role)
        .map((p) => ({ ...p, color: avatarColorFor(p.profileId) })),
    })).filter((g) => g.people.length > 0),
  );
}
