// Traces to: L2-038 (docs/detailed-designs/agile/planning-poker)
import { expect, test } from '../../fixtures/app';
import { PlanningPokerPage, StartPokerDialog } from '../../pages/planning-poker.page';

test.describe('Planning Poker', () => {
  function team(api: Parameters<Parameters<typeof test>[2]>[0]['api']) {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const marcus = api.addAccount({
      email: 'marcus@example.org',
      name: 'Marcus Lee',
      roles: ['EventLead'],
    });
    const ruth = api.addAccount({
      email: 'ruth@example.org',
      name: 'Ruth Alvarez',
      roles: ['Volunteer'],
    });
    const ws = api.agile.addWorkspace({
      name: 'Toronto team',
      ownerId: grace.profileId,
      memberIds: [marcus.profileId, ruth.profileId],
    });
    const briefs = api.agile.addItem({
      workspaceId: ws.id,
      kind: 'Story',
      title: 'Shelter problem briefs for teams',
      description: 'As a hackathon team, I want a one-page brief for each shelter problem.',
    });
    const kiosk = api.agile.addItem({
      workspaceId: ws.id,
      kind: 'Story',
      title: 'Volunteer check-in kiosk',
    });
    return { grace, marcus, ruth, ws, briefs, kiosk };
  }

  test('a member starts a session for chosen stories and invites members', async ({
    page,
    api,
    axe,
  }) => {
    const { grace, marcus, ws } = team(api);
    const poker = new PlanningPokerPage(page);
    await api.signInAs(marcus, `/workspaces/${ws.id}/poker`);
    await expect(poker.noSession).toBeVisible();
    await axe.check();

    await poker.startSession.click();
    const dialog = new StartPokerDialog(page);
    await dialog.start.click();
    await expect(dialog.storyError).toBeVisible();
    await dialog.story('Shelter problem briefs for teams').check();
    await dialog.story('Volunteer check-in kiosk').check();
    await dialog.member('Grace Okonkwo').check();
    await axe.check();
    await dialog.start.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(poker.frame.subtitle).toHaveText(
      'Planning Poker · live · facilitator: Marcus Lee',
    );
    await expect(poker.nowEstimating).toHaveText('Now estimating · 1 of 2');
    await expect(poker.votesHeading).toHaveText('Votes (2 invited)');
    await expect(poker.vote('Grace Okonkwo')).toHaveAccessibleName('Grace Okonkwo: still choosing');
    expect(api.callsTo('POST', `/api/workspaces/${ws.id}/poker-sessions`)[0].body).toEqual({
      storyIds: [api.agile.items[0].id, api.agile.items[1].id],
      invitedIds: [grace.profileId],
    });
    await axe.check();
  });

  test('a participant votes, and sees who else voted live without the values', async ({
    page,
    api,
    axe,
  }) => {
    const { grace, marcus, ruth, ws, briefs, kiosk } = team(api);
    const session = api.agile.addPokerSession({
      workspaceId: ws.id,
      storyIds: [briefs.id, kiosk.id],
      facilitatorId: marcus.profileId,
      invitedIds: [grace.profileId, ruth.profileId],
    });
    const poker = new PlanningPokerPage(page);
    await api.signInAs(grace, `/workspaces/${ws.id}/poker`);
    await expect(poker.story).toContainText('Shelter problem briefs for teams');
    await expect(poker.status).toContainText('0 of 3 have voted.');
    await expect(poker.status).toContainText('Votes stay hidden until Marcus reveals them.');

    await poker.card('8').click();
    await expect(poker.card('8')).toHaveAttribute('aria-pressed', 'true');
    await expect(poker.status).toContainText('1 of 3 have voted.');
    expect(api.callsTo('PUT', `/api/poker-sessions/${session.id}/vote`)[0].body).toEqual({
      value: '8',
    });

    await expect.poll(() => api.agile.pokerWatchers(session.id)).toBe(1);
    api.agile.pokerChanged(session, (s) => s.votes.set(ruth.profileId, '13'));
    await expect(poker.vote('Ruth Alvarez')).toHaveAccessibleName('Ruth Alvarez: voted');
    await expect(poker.status).toContainText('2 of 3 have voted.');
    await axe.check();
  });

  test('the facilitator reveals, re-votes and sets the final points', async ({
    page,
    api,
    axe,
  }) => {
    const { grace, marcus, ruth, ws, briefs, kiosk } = team(api);
    const session = api.agile.addPokerSession({
      workspaceId: ws.id,
      storyIds: [briefs.id, kiosk.id],
      facilitatorId: marcus.profileId,
      invitedIds: [grace.profileId, ruth.profileId],
      votes: new Map([
        [grace.profileId, '8'],
        [ruth.profileId, '13'],
      ]),
    });
    const poker = new PlanningPokerPage(page);
    await api.signInAs(marcus, `/workspaces/${ws.id}/poker`);
    await poker.card('5').click();

    await poker.reveal.click();
    await expect(poker.vote('Ruth Alvarez')).toHaveAccessibleName('Ruth Alvarez: 13 points');
    await expect(poker.status).toContainText('Votes differ: 5 to 13');
    await expect(poker.status).toContainText(
      'Ask Marcus and Ruth to explain, then re-vote or set the final points.',
    );
    await axe.check();

    await poker.revote.click();
    await expect(poker.vote('Ruth Alvarez')).toHaveAccessibleName('Ruth Alvarez: still choosing');
    expect(session.round).toBe(2);

    await poker.card('8').click();
    await poker.reveal.click();
    await expect(poker.finalPoints).toHaveValue('8');
    await poker.setPoints.click();

    await expect(poker.status).toContainText('Marcus set 8 points');
    await expect(poker.status).toContainText(
      'Saved to “Shelter problem briefs for teams”. Next up: Volunteer check-in kiosk.',
    );
    await expect(poker.nowEstimating).toHaveText('Now estimating · 2 of 2');
    expect(briefs.storyPoints).toBe(8);
    await axe.check();
  });

  test('the facilitator ends the session', async ({ page, api }) => {
    const { marcus, ws, briefs } = team(api);
    api.agile.addPokerSession({
      workspaceId: ws.id,
      storyIds: [briefs.id],
      facilitatorId: marcus.profileId,
    });
    const poker = new PlanningPokerPage(page);
    await api.signInAs(marcus, `/workspaces/${ws.id}/poker`);

    await poker.end.click();

    await expect(poker.noSession).toBeVisible();
    await expect(poker.toast).toContainText('Session ended');
  });

  test('a participant who does not facilitate gets no facilitator controls', async ({
    page,
    api,
  }) => {
    const { grace, marcus, ws, briefs } = team(api);
    api.agile.addPokerSession({
      workspaceId: ws.id,
      storyIds: [briefs.id],
      facilitatorId: marcus.profileId,
      invitedIds: [grace.profileId],
    });
    const poker = new PlanningPokerPage(page);
    await api.signInAs(grace, `/workspaces/${ws.id}/poker`);

    await expect(poker.deck).toBeVisible();
    await expect(poker.reveal).toHaveCount(0);
    await expect(poker.end).toHaveCount(0);
  });

  test('Staff watch but do not vote', async ({ page, api, axe }) => {
    const { marcus, ws, briefs } = team(api);
    const daniel = api.addAccount({
      email: 'daniel@example.org',
      name: 'Daniel Reyes',
      roles: ['Staff'],
    });
    api.agile.addPokerSession({
      workspaceId: ws.id,
      storyIds: [briefs.id],
      facilitatorId: marcus.profileId,
    });
    const poker = new PlanningPokerPage(page);

    await api.signInAs(daniel, `/workspaces/${ws.id}/poker`);

    await expect(poker.watching).toContainText(
      'Watching as Staff You can follow the session live, but only workspace members vote.',
    );
    await expect(poker.deck).toHaveCount(0);
    await axe.check();
  });

  test('someone outside the workspace is refused', async ({ page, api }) => {
    const { ws } = team(api);
    const leah = api.addAccount({
      email: 'leah@example.org',
      name: 'Leah Thompson',
      roles: ['Volunteer'],
    });
    const poker = new PlanningPokerPage(page);

    await api.signInAs(leah, `/workspaces/${ws.id}/poker`);

    await expect(poker.frame.notMember).toBeVisible();
  });
});
