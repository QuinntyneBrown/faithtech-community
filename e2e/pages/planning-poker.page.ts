import { Locator, Page } from '@playwright/test';

import { WorkspaceFrame } from './workspace.frame';

/** Planning Poker at /workspaces/{id}/poker (docs/mocks/pages/planning-poker). */
export class PlanningPokerPage {
  readonly frame: WorkspaceFrame;
  readonly noSession: Locator;
  readonly startSession: Locator;
  readonly nowEstimating: Locator;
  readonly story: Locator;
  readonly status: Locator;
  readonly deck: Locator;
  readonly votesHeading: Locator;
  readonly watching: Locator;
  readonly reveal: Locator;
  readonly revote: Locator;
  readonly finalPoints: Locator;
  readonly setPoints: Locator;
  readonly end: Locator;
  readonly toast: Locator;
  readonly voteFailed: Locator;
  readonly deckError: Locator;

  constructor(private readonly page: Page) {
    this.frame = new WorkspaceFrame(page);
    this.noSession = page.getByRole('heading', { name: 'No session running' });
    this.startSession = page.getByRole('button', { name: 'Start a session' });
    this.nowEstimating = page.getByText(/^Now estimating · \d+ of \d+$/);
    this.story = page.getByRole('heading', { level: 2 }).first();
    this.status = page.locator('ft-alert').first();
    this.deck = page.getByRole('group', { name: 'Your vote' });
    this.votesHeading = page.getByRole('heading', { name: /^Votes \(\d+ invited\)$/ });
    this.watching = page.locator('ft-alert').filter({ hasText: /^Watching/ });
    this.reveal = page.getByRole('button', { name: 'Reveal votes' });
    this.revote = page.getByRole('button', { name: 'Re-vote' });
    this.finalPoints = page.getByRole('combobox', { name: 'Final points' });
    this.setPoints = page.getByRole('button', { name: 'Set points' });
    this.end = page.getByRole('button', { name: 'End session' });
    this.toast = page.locator('ft-toast');
    this.voteFailed = page.locator('ft-alert').filter({ hasText: 'We couldn’t save your vote' });
    this.deckError = page.getByText('Voting has closed on this story. Your vote wasn’t counted.');
  }

  async open(workspaceId: string): Promise<void> {
    await this.page.goto(`/workspaces/${workspaceId}/poker`);
  }

  /** A card of the deck: "8" or "?". */
  card(value: string): Locator {
    return this.deck.getByRole('button', {
      name: new RegExp(
        `^${value === '?' ? '\\?' : value}\\s*${value === '?' ? 'Unsure' : 'points'}$`,
      ),
    });
  }

  /** A participant's tile, named "Grace Okonkwo: voted", "…: still choosing" or "…: 8 points". */
  vote(name: string): Locator {
    return this.page.getByRole('img', { name: new RegExp(`^${name}: `) });
  }
}

/** Start a Planning Poker session (docs/mocks/dialogs/start-poker). */
export class StartPokerDialog {
  readonly dialog: Locator;
  readonly start: Locator;
  readonly storyError: Locator;
  readonly failed: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Start a Planning Poker session' });
    this.start = this.dialog.getByRole('button', { name: /^Start and invite/ });
    this.failed = this.dialog.locator('ft-alert').filter({ hasText: 'That didn’t work' });
    this.storyError = this.dialog.getByText('Choose at least one story to estimate.', {
      exact: true,
    });
  }

  story(title: string): Locator {
    return this.dialog
      .getByRole('group', { name: 'Stories to estimate' })
      .getByRole('checkbox', { name: new RegExp(`^${title}`) });
  }

  member(name: string): Locator {
    return this.dialog
      .getByRole('group', { name: 'Members' })
      .getByRole('checkbox', { name: new RegExp(`^${name}`) });
  }
}
