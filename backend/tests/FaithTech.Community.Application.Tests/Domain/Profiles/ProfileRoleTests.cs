// Traces to: L2-008, L2-037
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Tests.Domain.Profiles;

public class ProfileRoleTests
{
    private static readonly DateTime Now = new(2026, 10, 21, 12, 0, 0, DateTimeKind.Utc);
    private static readonly Guid Granter = Guid.NewGuid();

    [Fact]
    public void A_new_profile_holds_no_role()
    {
        Assert.Empty(new Profile("Ada").Roles);
    }

    [Fact]
    public void A_profile_can_hold_any_combination_of_roles()
    {
        var profile = new Profile("Ada");

        profile.AddRole(Role.CityLead, Granter, Now);
        profile.AddRole(Role.CommunicationsLead, Granter, Now);
        profile.AddRole(Role.Staff, Granter, Now);

        Assert.Equal([Role.CityLead, Role.CommunicationsLead, Role.Staff], profile.Roles.Select(r => r.Role));
        Assert.True(profile.HasRole(Role.CommunicationsLead));
        Assert.False(profile.HasRole(Role.EventLead));
    }

    [Fact]
    public void An_added_role_records_who_granted_it_and_when()
    {
        var profile = new Profile("Ada");

        profile.AddRole(Role.Volunteer, Granter, Now);

        var granted = Assert.Single(profile.Roles);
        Assert.Equal((profile.Id, Granter, Now), (granted.ProfileId, granted.GrantedBy, granted.GrantedAtUtc));
    }

    [Fact]
    public void Adding_a_role_the_profile_already_holds_is_rejected()
    {
        var profile = new Profile("Ada");
        profile.AddRole(Role.Attendee, Granter, Now);

        Assert.Throws<InvalidOperationException>(() => profile.AddRole(Role.Attendee, Granter, Now));
        Assert.Single(profile.Roles);
    }

    [Fact]
    public void Removing_a_role_takes_it_away()
    {
        var profile = new Profile("Ada");
        profile.AddRole(Role.Attendee, Granter, Now);
        profile.AddRole(Role.Volunteer, Granter, Now);

        profile.RemoveRole(Role.Attendee);

        Assert.Equal([Role.Volunteer], profile.Roles.Select(r => r.Role));
    }

    [Fact]
    public void Removing_a_role_the_profile_does_not_hold_is_rejected()
    {
        Assert.Throws<InvalidOperationException>(() => new Profile("Ada").RemoveRole(Role.Staff));
    }

    [Fact]
    public void Removing_the_city_lead_role_raises_city_lead_role_removed()
    {
        var profile = new Profile("Ada");
        profile.AddRole(Role.CityLead, Granter, Now);

        profile.RemoveRole(Role.CityLead);

        Assert.Equal([new CityLeadRoleRemoved(profile.Id)], profile.DomainEvents);
    }

    [Fact]
    public void Removing_another_role_raises_no_event()
    {
        var profile = new Profile("Ada");
        profile.AddRole(Role.EventLead, Granter, Now);

        profile.RemoveRole(Role.EventLead);

        Assert.Empty(profile.DomainEvents);
    }

    [Fact]
    public void Clearing_domain_events_empties_them()
    {
        var profile = new Profile("Ada");
        profile.AddRole(Role.CityLead, Granter, Now);
        profile.RemoveRole(Role.CityLead);

        profile.ClearDomainEvents();

        Assert.Empty(profile.DomainEvents);
    }
}
