// Traces to: L2-138 AC6, AC7, L2-141 AC3
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Tests.Domain.Profiles;

/// <summary>A chapter-scopable role is held once per chapter tag, and once untagged; any other role never carries a tag.</summary>
public class ChapterTaggedRoleTests
{
    private static readonly DateTime Now = new(2026, 10, 21, 12, 0, 0, DateTimeKind.Utc);
    private static readonly Guid Granter = Guid.NewGuid();
    private static readonly Guid Toronto = Guid.NewGuid();
    private static readonly Guid Austin = Guid.NewGuid();

    private static RoleDefinition Lead(bool scopable = true)
    {
        var lead = new RoleDefinition(Guid.NewGuid(), "Lead", "Lead", string.Empty, [Capability.ManageEvents], 1);
        lead.SetFlags(showOnTeam: true, chapterScopable: scopable, isOversight: false);
        return lead;
    }

    [Fact]
    public void A_scopable_role_is_held_once_per_chapter_and_once_untagged()
    {
        var profile = new Profile("Ada");
        var lead = Lead();

        profile.AddRole(lead, Granter, Now, Toronto);
        profile.AddRole(lead, Granter, Now, Austin);
        profile.AddRole(lead, Granter, Now);

        Assert.Equal([Toronto, Austin, (Guid?)null], profile.Roles.Select(r => r.ChapterId));
        Assert.True(profile.HasRole(lead.Id, Toronto));
        Assert.True(profile.HasRole(lead.Id, null));
    }

    [Fact]
    public void The_same_role_with_the_same_tag_is_refused()
    {
        var profile = new Profile("Ada");
        var lead = Lead();
        profile.AddRole(lead, Granter, Now, Toronto);

        Assert.Throws<InvalidOperationException>(() => profile.AddRole(lead, Granter, Now, Toronto));
        Assert.Single(profile.Roles);
    }

    [Fact]
    public void A_chapter_on_a_role_that_is_not_scopable_is_refused()
    {
        var profile = new Profile("Ada");

        Assert.Throws<InvalidOperationException>(() => profile.AddRole(Lead(scopable: false), Granter, Now, Toronto));
        Assert.Empty(profile.Roles);
    }

    [Fact]
    public void Removing_one_tagged_assignment_keeps_the_others_and_their_capabilities()
    {
        var profile = new Profile("Ada");
        var lead = Lead();
        profile.AddRole(lead, Granter, Now, Toronto);
        profile.AddRole(lead, Granter, Now, Austin);

        profile.RemoveRole(lead.Id, Toronto);

        Assert.Equal([Austin], profile.Roles.Select(r => r.ChapterId));
        Assert.Empty(profile.DomainEvents);
        Assert.Throws<InvalidOperationException>(() => profile.RemoveRole(lead.Id, Toronto));
        Assert.Throws<InvalidOperationException>(() => profile.RemoveRole(lead.Id));
    }
}
