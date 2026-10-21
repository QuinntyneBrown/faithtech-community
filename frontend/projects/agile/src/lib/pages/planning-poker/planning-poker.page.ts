import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  AGILE_LIVE_SERVICE,
  AGILE_SERVICE,
  PokerCard,
  PokerParticipantDto,
  PokerSessionDto,
  WorkspaceDto,
} from '@faithtech-community/api';
import {
  AlertComponent,
  AlertStatus,
  AvatarComponent,
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  ClusterComponent,
  DialogService,
  EmptyStateComponent,
  EstimateCardComponent,
  EstimateOption,
  EstimatePickerComponent,
  FormFieldComponent,
  ListComponent,
  ListItemComponent,
  ListSkeletonComponent,
  SelectComponent,
  SelectOption,
  SplitComponent,
  StackComponent,
  ToastService,
} from '@faithtech-community/components';
import { Subscription, firstValueFrom } from 'rxjs';

import { StartPokerDialog, StartPokerData } from '../../dialogs';
import { POINTS, firstName, flatten } from '../../work-item-labels';
import { WorkspaceFrameComponent } from '../workspace-frame';

type State = 'loading' | 'loaded' | 'error' | 'not-found';

interface Status {
  status: AlertStatus;
  heading: string;
  text: string;
}

/**
 * Planning Poker (L2-038): the story being estimated, the deck, who has voted and, for the facilitator, reveal,
 * re-vote, final points and end. Changes go over HTTP; SignalR only says "changed", and the page re-reads the
 * session (ADR 0012), which also restores the caller's vote after a dropped connection (AC8).
 * Matches docs/mocks/pages/planning-poker.
 */
@Component({
  selector: 'ft-planning-poker-page',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    AvatarComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    ClusterComponent,
    EmptyStateComponent,
    EstimateCardComponent,
    EstimatePickerComponent,
    FormFieldComponent,
    ListComponent,
    ListItemComponent,
    ListSkeletonComponent,
    SelectComponent,
    SplitComponent,
    StackComponent,
    WorkspaceFrameComponent,
  ],
  templateUrl: './planning-poker.page.html',
  styleUrl: './planning-poker.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanningPokerPage {
  private readonly agile = inject(AGILE_SERVICE);
  private readonly live = inject(AGILE_LIVE_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private watching: Subscription | null = null;

  /** The workspace id from the route. */
  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly workspace = signal<WorkspaceDto | null>(null);
  protected readonly session = signal<PokerSessionDto | null>(null);
  protected readonly busy = signal(false);
  protected readonly finalPoints = new FormControl('', { nonNullable: true });
  protected readonly pointOptions: SelectOption[] = POINTS.map((p) => ({
    value: String(p),
    label: String(p),
  }));

  protected readonly canStart = computed(() => {
    const access = this.workspace()?.access;
    return access === 'Owner' || access === 'Member';
  });
  protected readonly facilitatorFirstName = computed(() =>
    firstName(this.session()?.facilitatorName ?? ''),
  );
  protected readonly subtitle = computed(() => {
    const session = this.session();
    return session
      ? `Planning Poker · live · facilitator: ${session.facilitatorName}`
      : 'Planning Poker';
  });
  /** The card shown as chosen; follows the saved vote, and returns to it when a vote fails. */
  protected readonly chosen = signal<EstimateOption | null>(null);
  /** The caller just withdrew their vote (mock withdrawn). */
  protected readonly withdrew = signal(false);
  /** The saved vote, shown after a vote failed to send (mock vote-failed). */
  protected readonly voteFailed = signal<string | null>(null);
  /** The server refused the vote because voting closed (mock invalid). */
  protected readonly voteError = signal('');
  protected readonly status = computed<Status | null>(() => {
    const session = this.session();
    if (!session) return null;
    const facilitator = this.facilitatorFirstName();
    const voted = session.participants.filter((p) => p.hasVoted).length;
    if (!session.isRevealed) {
      const counted = `${voted} of ${session.participants.length} have voted.`;
      if (this.voteError()) {
        return { status: 'info', heading: counted, text: 'Voting on this story has closed.' };
      }
      if (this.withdrew()) {
        return {
          status: 'info',
          heading: 'You withdrew your vote.',
          text: `${counted} Votes stay hidden until ${facilitator} reveals them.`,
        };
      }
      if (session.lastPoints !== null && voted === 0) {
        return {
          status: 'success',
          heading: `${facilitator} set ${session.lastPoints} points`,
          text: `Saved to “${session.lastStoryTitle}”. Next up: ${session.story.title}.`,
        };
      }
      return {
        status: 'info',
        heading: counted,
        text: `Votes stay hidden until ${facilitator} reveals them.`,
      };
    }
    const numbers = session.participants
      .map((p) => Number(p.vote))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!numbers.length) {
      return {
        status: 'info',
        heading: 'Nobody gave points',
        text: 'Start a re-vote to try again.',
      };
    }
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    if (min === max) {
      return {
        status: 'success',
        heading: `Everyone agrees: ${min}`,
        text: session.isFacilitator
          ? 'Set the final points to move on.'
          : `${facilitator} will set the final points.`,
      };
    }
    const names = session.participants
      .filter((p) => p.vote === String(min) || p.vote === String(max))
      .map((p) => firstName(p.name))
      .join(' and ');
    return {
      status: 'warning',
      heading: `Votes differ: ${min} to ${max}`,
      text: session.isFacilitator
        ? `Ask ${names} to explain, then re-vote or set the final points.`
        : `${names} are sharing their reasoning. ${facilitator} may ask for a re-vote.`,
    };
  });

  constructor() {
    effect(() => void this.load(this.id()));
  }

  protected title(participant: PokerParticipantDto): string {
    return participant.isFacilitator ? `${participant.name} · facilitator` : participant.name;
  }

  /** Before the reveal a vote shows only as a tick; the tile needs some value to show it. */
  protected tile(participant: PokerParticipantDto): EstimateOption | null {
    if (!participant.hasVoted) return null;
    return card(participant.vote) ?? '?';
  }

  protected retry(): void {
    void this.load(this.id());
  }

  protected async start(): Promise<void> {
    const workspace = this.workspace();
    if (!workspace) return;
    const backlog = await firstValueFrom(this.agile.getBacklog(workspace.id));
    const stories = flatten(backlog).filter((n) => n.kind === 'Story' && n.status !== 'Done');
    const ref = this.dialogs.open<PokerSessionDto, StartPokerData>(StartPokerDialog, {
      data: { workspace, stories },
    });
    const session = await firstValueFrom(ref.closed);
    if (!session) return;
    this.toasts.show({
      variant: 'success',
      heading: 'Session started',
      text: 'Invitees were notified.',
    });
    this.show(session);
  }

  /** Pressing the chosen card again withdraws the vote (L2-038 AC2). */
  protected async vote(option: EstimateOption | null): Promise<void> {
    const session = this.session();
    if (!session || this.busy()) return;
    const saved = card(session.myVote);
    this.withdrew.set(false);
    this.voteFailed.set(null);
    this.voteError.set('');
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.agile.vote(session.id, option === null ? null : (String(option) as PokerCard)),
      );
      this.withdrew.set(option === null);
      await this.refresh();
    } catch (error) {
      this.chosen.set(saved);
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.voteError.set('Voting has closed on this story. Your vote wasn’t counted.');
        await this.refresh();
      } else {
        this.voteFailed.set(
          saved === null
            ? 'You haven’t voted yet. Check your connection and try again.'
            : `Your vote is still ${saved === '?' ? 'unsure' : `${saved} points`}. Check your connection and try again.`,
        );
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected reveal(): void {
    void this.act((s) => this.agile.revealVotes(s.id));
  }

  protected revote(): void {
    void this.act((s) => this.agile.revote(s.id));
  }

  protected setPoints(): void {
    void this.act((s) => this.agile.setFinalPoints(s.id, Number(this.finalPoints.value)));
  }

  protected async end(): Promise<void> {
    if (await this.act((s) => this.agile.endPokerSession(s.id))) {
      this.toasts.show({ variant: 'success', heading: 'Session ended' });
    }
  }

  private async act(
    call: (session: PokerSessionDto) => ReturnType<typeof this.agile.revealVotes>,
  ): Promise<boolean> {
    const session = this.session();
    if (!session || this.busy()) return false;
    this.busy.set(true);
    try {
      await firstValueFrom(call(session));
      await this.refresh();
      return true;
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'That didn’t work',
        text: 'We couldn’t reach FaithTech. Try again.',
      });
      await this.refresh();
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      this.workspace.set(await firstValueFrom(this.agile.getWorkspace(id)));
      this.show(await firstValueFrom(this.agile.getCurrentPokerSession(id)));
      this.state.set('loaded');
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error',
      );
    }
  }

  private async refresh(): Promise<void> {
    try {
      this.show(await firstValueFrom(this.agile.getCurrentPokerSession(this.id())));
    } catch {
      this.state.set('error');
    }
  }

  /** Shows the session and, when it changes, watches it live; null means none is running. */
  private show(session: PokerSessionDto | null): void {
    const previous = this.session();
    this.session.set(session);
    this.chosen.set(card(session?.myVote));
    if (session?.round !== previous?.round || session?.storyNumber !== previous?.storyNumber) {
      this.withdrew.set(false);
      this.voteError.set('');
    }
    if (session?.isRevealed && (!previous?.isRevealed || previous.round !== session.round)) {
      this.finalPoints.setValue(String(mostCommon(session) ?? POINTS[0]));
    }
    if (session?.id === previous?.id && this.watching) return;
    this.watching?.unsubscribe();
    this.watching = null;
    if (!session) return;
    this.watching = this.live
      .watchPokerSession(session.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => void this.refresh(),
        // Live updates are an enhancement; actions still re-read the session.
        error: () => undefined,
      });
  }
}

function card(vote: PokerCard | null | undefined): EstimateOption | null {
  if (vote === null || vote === undefined) return null;
  return vote === '?' ? '?' : Number(vote);
}

/** The points most participants chose, the higher one on a tie; the facilitator's starting choice. */
function mostCommon(session: PokerSessionDto): number | null {
  const counts = new Map<number, number>();
  for (const p of session.participants) {
    const n = Number(p.vote);
    if (Number.isFinite(n) && n > 0) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  let best: number | null = null;
  for (const [n, c] of counts) {
    if (best === null || c > counts.get(best)! || (c === counts.get(best) && n > best)) best = n;
  }
  return best;
}
