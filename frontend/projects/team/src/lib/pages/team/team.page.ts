import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  AUTH_SERVICE,
  ORGANISATION_SERVICE,
  chapterFilterOptions,
  TEAM_SERVICE,
  TeamMemberDto,
  TeamRoleFilter,
  hasAny,
  OrganisationRoles,
} from '@faithtech-community/api';
import {
  AlertComponent,
  AvatarComponent,
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  ChipComponent,
  ClusterComponent,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  ListComponent,
  ListItemComponent,
  ListSkeletonComponent,
  PageHeaderComponent,
  SelectComponent,
  SelectOption,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'loading' | 'loaded' | 'error';

const ROLE_CHIPS: { label: string; value: TeamRoleFilter | null }[] = [
  { label: 'All', value: null },
  { label: 'Leads', value: 'Leads' },
  { label: 'Volunteers', value: 'Volunteers' },
];

/**
 * Everyone with a lead or volunteer role (L2-019), matching docs/mocks/pages/team. The chapter filter lists the
 * organisation's chapters, and is absent while chapters are off (L2-142).
 */
@Component({
  selector: 'ft-team-page',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    AvatarComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    ChipComponent,
    ClusterComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    ListComponent,
    ListItemComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
    SelectComponent,
  ],
  templateUrl: './team.page.html',
  styleUrl: './team.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamPage {
  private readonly organisationRoles = inject(OrganisationRoles);
  private readonly team = inject(TEAM_SERVICE);
  private readonly capabilities = inject(AUTH_SERVICE).capabilities;
  private readonly organisations = inject(ORGANISATION_SERVICE);

  protected readonly roleChips = ROLE_CHIPS;
  protected readonly chapter = new FormControl('', { nonNullable: true });

  protected readonly state = signal<State>('loading');
  protected readonly members = signal<TeamMemberDto[]>([]);
  protected readonly role = signal<TeamRoleFilter | null>(null);
  /** "All {chapters}" and the chapters, or none while chapters are off. */
  protected readonly chapterOptions = signal<SelectOption[]>([]);
  protected readonly chapterLabel = signal('');
  private readonly selectedChapter = signal<string | null>(null);
  private request = 0;
  /** The continuation for the next page; null once every matching member is shown. */
  protected readonly next = signal<string | null>(null);
  protected readonly total = signal(0);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);
  protected readonly count = computed(
    () => `Showing ${this.members().length} of ${this.total()} members`,
  );

  /** InviteMembers sends invites (L2-010, L2-135 AC7). */
  protected readonly canInvite = computed(() => hasAny(this.capabilities(), 'InviteMembers'));
  protected readonly filtered = computed(
    () => this.role() !== null || this.selectedChapter() !== null,
  );
  /** "No volunteers in Vancouver yet", worded as the no-results mock words it (L2-142 AC5). */
  protected readonly noResultsHeading = computed(() => {
    const role = this.role();
    const who = role ? role.toLowerCase() : 'team members';
    const id = this.selectedChapter();
    const chapter = id && this.chapterOptions().find((o) => o.value === id)?.label;
    return chapter ? `No ${who} in ${chapter} yet` : `No ${who} yet`;
  });
  /** "Try a different role or city." */
  protected readonly noResultsText = computed(() =>
    this.chapterLabel()
      ? `Try a different role or ${this.chapterLabel().toLowerCase()}.`
      : 'Try a different role.',
  );

  constructor() {
    this.chapter.valueChanges.subscribe((value) => {
      this.selectedChapter.set(value || null);
      void this.load();
    });
    this.organisations.get().subscribe({
      next: (organisation) => {
        this.chapterOptions.set(chapterFilterOptions(organisation));
        this.chapterLabel.set(organisation.chapterLabel?.singular ?? '');
      },
      // Without the list the team is shown organisation-wide, with no filter.
      error: () => this.chapterOptions.set([]),
    });
    void this.load();
  }

  /** Each role as its badge reads, "{role} · {chapter}" when tagged (L2-141 AC3). */
  protected labels(member: TeamMemberDto): string[] {
    return member.roleBadges ?? member.roles.map((r) => this.organisationRoles.label(r));
  }

  protected chooseRole(value: TeamRoleFilter | null): void {
    if (this.role() === value) return;
    this.role.set(value);
    void this.load();
  }

  protected showEveryone(): void {
    this.role.set(null);
    if (this.chapter.value) {
      this.chapter.setValue('');
    } else {
      void this.load();
    }
  }

  protected retry(): void {
    void this.load();
  }

  /** Appends the next page; a failure keeps what is shown and says so next to Show more. */
  protected async loadMore(): Promise<void> {
    const after = this.next();
    if (!after || this.loadingMore()) return;
    const request = this.request;
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    try {
      const list = await firstValueFrom(
        this.team.list({ role: this.role(), chapterId: this.selectedChapter() }, after),
      );
      if (request !== this.request) return;
      this.members.update((members) => [...members, ...list.members]);
      this.next.set(list.next);
      this.total.set(list.totalCount);
    } catch {
      if (request === this.request) this.moreFailed.set(true);
    } finally {
      if (request === this.request) this.loadingMore.set(false);
    }
  }

  private async load(): Promise<void> {
    // Only the latest request may update the page, so a slow answer never overwrites a newer filter.
    const request = ++this.request;
    this.state.set('loading');
    this.loadingMore.set(false);
    this.moreFailed.set(false);
    try {
      const list = await firstValueFrom(
        this.team.list({ role: this.role(), chapterId: this.selectedChapter() }),
      );
      if (request !== this.request) return;
      this.members.set(list.members);
      this.next.set(list.next);
      this.total.set(list.totalCount);
      this.state.set('loaded');
    } catch {
      if (request === this.request) this.state.set('error');
    }
  }
}
