// Traces to: L2-031, L2-037, L2-051
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Tests.Domain.Agile;

public class WorkspaceTests
{
    internal static readonly DateTimeOffset Now = new(2026, 10, 21, 12, 0, 0, TimeSpan.Zero);

    internal static Profile ProfileWith(params Role[] roles)
    {
        var profile = new Profile("Member");
        foreach (var role in roles)
        {
            profile.AddRole(role, Guid.NewGuid(), Now.UtcDateTime);
        }

        return profile;
    }

    internal static Workspace NewWorkspace(WorkspaceMethod method = WorkspaceMethod.Scrum) => new("Hackathon app", method, Guid.NewGuid());

    [Fact]
    public void The_creator_owns_a_new_workspace()
    {
        var owner = Guid.NewGuid();

        var workspace = new Workspace("Hackathon app", WorkspaceMethod.Kanban, owner);

        Assert.Equal(("Hackathon app", WorkspaceMethod.Kanban, owner, false), (workspace.Name, workspace.Method, workspace.OwnerId, workspace.IsArchived));
        Assert.True(workspace.IsMember(owner));
    }

    [Fact]
    public void A_workspace_needs_a_name()
    {
        Assert.Throws<ArgumentException>(() => new Workspace(" ", WorkspaceMethod.Scrum, Guid.NewGuid()));
    }

    [Fact]
    public void Renaming_needs_a_name()
    {
        var workspace = NewWorkspace();

        workspace.Rename("Community app");
        Assert.Equal("Community app", workspace.Name);

        Assert.Throws<ArgumentException>(() => workspace.Rename(""));
    }

    [Theory]
    [InlineData(Role.Volunteer)]
    [InlineData(Role.EventLead)]
    [InlineData(Role.CityLead)]
    public void A_profile_holding_a_lead_or_volunteer_role_can_be_added(Role role)
    {
        var workspace = NewWorkspace();
        var profile = ProfileWith(role);

        workspace.AddMember(profile, Now);

        var member = Assert.Single(workspace.Members);
        Assert.Equal((workspace.Id, profile.Id, Now), (member.WorkspaceId, member.ProfileId, member.AddedAt));
        Assert.True(workspace.IsMember(profile.Id));
    }

    [Theory]
    [InlineData(Role.Attendee)]
    [InlineData(Role.Staff)]
    [InlineData(Role.ProductEngineer)]
    public void A_profile_without_a_lead_or_volunteer_role_cannot_be_added(Role role)
    {
        var workspace = NewWorkspace();

        Assert.Throws<InvalidOperationException>(() => workspace.AddMember(ProfileWith(role), Now));
        Assert.Empty(workspace.Members);
    }

    [Fact]
    public void Adding_a_member_twice_is_rejected()
    {
        var workspace = NewWorkspace();
        var profile = ProfileWith(Role.Volunteer);
        workspace.AddMember(profile, Now);

        Assert.Throws<InvalidOperationException>(() => workspace.AddMember(profile, Now));
    }

    [Fact]
    public void Archiving_hides_the_workspace_and_restoring_brings_it_back()
    {
        var workspace = NewWorkspace();

        workspace.Archive();
        Assert.True(workspace.IsArchived);
        Assert.Throws<InvalidOperationException>(() => workspace.Archive());

        workspace.Restore();
        Assert.False(workspace.IsArchived);
        Assert.Throws<InvalidOperationException>(() => workspace.Restore());
    }

    [Fact]
    public void Ownership_can_be_reassigned_to_another_city_lead()
    {
        var workspace = NewWorkspace();
        var newOwner = ProfileWith(Role.CityLead);

        workspace.ReassignOwner(newOwner);

        Assert.Equal(newOwner.Id, workspace.OwnerId);
    }

    [Fact]
    public void Ownership_cannot_go_to_a_profile_without_the_city_lead_role()
    {
        var workspace = NewWorkspace();
        var owner = workspace.OwnerId;

        Assert.Throws<InvalidOperationException>(() => workspace.ReassignOwner(ProfileWith(Role.EventLead)));
        Assert.Equal(owner, workspace.OwnerId);
    }
}
