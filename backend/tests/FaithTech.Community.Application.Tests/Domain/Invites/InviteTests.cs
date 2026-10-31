// Traces to: L2-010, L2-011
using FaithTech.Community.Domain.Invites;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Tests.Domain.Invites;

public class InviteTests
{
    private static readonly DateTimeOffset Sent = new(2026, 10, 1, 9, 0, 0, TimeSpan.Zero);
    private static readonly Guid Inviter = Guid.NewGuid();

    private static Invite NewInvite(Role? role = null) => new("grace@example.org", "hash", role?.ToString(), Inviter, Sent);

    [Fact]
    public void A_new_invite_records_who_sent_it_and_expires_after_14_days()
    {
        var invite = NewInvite(Role.Volunteer);

        Assert.Equal(
            ("grace@example.org", "hash", "Volunteer", Inviter, Sent, Sent.AddDays(14)),
            (invite.Email, invite.TokenHash, invite.PreassignedRole, invite.InvitedBy, invite.CreatedAt, invite.ExpiresAt));
    }

    [Fact]
    public void An_invite_keeps_an_optional_personal_note()
    {
        var invite = new Invite("grace@example.org", "hash", null, Inviter, Sent, "Come build with us!");

        Assert.Equal("Come build with us!", invite.Note);
        Assert.Null(NewInvite().Note);
    }

    [Theory]
    [InlineData("", "hash")]
    [InlineData("grace@example.org", " ")]
    public void An_invite_needs_an_email_and_a_token_hash(string email, string tokenHash)
    {
        Assert.Throws<ArgumentException>(() => new Invite(email, tokenHash, null, Inviter, Sent));
    }

    [Fact]
    public void An_invite_is_pending_until_it_expires()
    {
        var invite = NewInvite();

        Assert.Equal(InviteStatus.Pending, invite.Status(Sent.AddDays(14).AddTicks(-1)));
        Assert.Equal(InviteStatus.Expired, invite.Status(Sent.AddDays(14)));
    }

    [Fact]
    public void Accepting_a_pending_invite_marks_it_accepted()
    {
        var invite = NewInvite();
        var invitee = Guid.NewGuid();

        invite.MarkAccepted(invitee, Sent.AddDays(1));

        Assert.Equal(InviteStatus.Accepted, invite.Status(Sent.AddDays(30)));
        Assert.Equal((invitee, (DateTimeOffset?)Sent.AddDays(1)), (invite.AcceptedBy, invite.AcceptedAt));
    }

    [Fact]
    public void An_expired_invite_cannot_be_accepted()
    {
        Assert.Throws<InvalidOperationException>(() => NewInvite().MarkAccepted(Guid.NewGuid(), Sent.AddDays(15)));
    }

    [Fact]
    public void A_used_invite_cannot_be_accepted_again()
    {
        var invite = NewInvite();
        invite.MarkAccepted(Guid.NewGuid(), Sent.AddDays(1));

        Assert.Throws<InvalidOperationException>(() => invite.MarkAccepted(Guid.NewGuid(), Sent.AddDays(2)));
    }

    [Fact]
    public void Revoking_a_pending_invite_stops_it_working()
    {
        var invite = NewInvite();

        invite.Revoke(Sent.AddDays(2));

        Assert.Equal(InviteStatus.Revoked, invite.Status(Sent.AddDays(3)));
        Assert.Throws<InvalidOperationException>(() => invite.MarkAccepted(Guid.NewGuid(), Sent.AddDays(3)));
    }

    [Fact]
    public void Only_a_pending_invite_can_be_revoked()
    {
        var invite = NewInvite();
        invite.MarkAccepted(Guid.NewGuid(), Sent.AddDays(1));

        Assert.Throws<InvalidOperationException>(() => invite.Revoke(Sent.AddDays(2)));
    }
}
