// Traces to: L2-137 AC2, AC3, AC4; L2-138 AC1, AC3
using FaithTech.Community.Application.Admin;
using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Application.Tests.Admin;

// Which roles a caller may add and remove, from the organisation's grant rules (ADR 0033).
public class RoleGrantPolicyTests
{
    private static RoleDefinition Define(string key, params string[] capabilities) =>
        new(Guid.NewGuid(), key, key, string.Empty, capabilities, 1);

    // FaithTech's seed: a City Lead grants the six roles L2-151 lists; Staff, City Lead and System Admin only by an administrator.
    private static (RoleDefinition[] All, Dictionary<string, RoleDefinition> ByKey) FaithTech()
    {
        var byKey = new[]
        {
            Define("CityLead", Capability.AssignRoles, Capability.InviteMembers),
            Define("EventLead", Capability.ManageEvents),
            Define("CreateLead", Capability.InviteMembers),
            Define("CommunicationsLead", Capability.SendAnnouncements),
            Define("Staff", Capability.ViewReports),
            Define("Volunteer", Capability.JoinWorkspaces),
            Define("ProductEngineer"),
            Define("Attendee"),
            Define("SystemAdmin", Capability.AdministerOrganisation),
        }.ToDictionary(d => d.Key);
        byKey["CityLead"].SetGrantableRoles(
            new[] { "EventLead", "CreateLead", "CommunicationsLead", "Volunteer", "ProductEngineer", "Attendee" }.Select(k => byKey[k].Id));
        return ([.. byKey.Values], byKey);
    }

    private static string[] Keys(IEnumerable<Guid> ids, IEnumerable<RoleDefinition> all) =>
        [.. all.Where(d => ids.Contains(d.Id)).Select(d => d.Key).Order()];

    [Fact]
    public void A_City_Lead_may_grant_exactly_the_six_roles_its_rule_names()
    {
        var (all, byKey) = FaithTech();

        var grantable = RoleGrantPolicy.Grantable([Capability.AssignRoles], [byKey["CityLead"].Id], all);

        Assert.Equal(
            ["Attendee", "CommunicationsLead", "CreateLead", "EventLead", "ProductEngineer", "Volunteer"],
            Keys(grantable, all));
    }

    [Fact]
    public void An_administrator_may_grant_every_role_that_is_not_archived()
    {
        var (all, byKey) = FaithTech();
        byKey["Attendee"].Archive(DateTime.UtcNow);

        var grantable = RoleGrantPolicy.Grantable([Capability.AdministerOrganisation], [byKey["SystemAdmin"].Id], all);

        Assert.Equal(all.Length - 1, grantable.Count);
        Assert.DoesNotContain(byKey["Attendee"].Id, grantable);
    }

    [Fact]
    public void A_member_without_AssignRoles_may_grant_nothing_even_when_their_role_has_a_rule()
    {
        var (all, byKey) = FaithTech();

        Assert.Empty(RoleGrantPolicy.Grantable([Capability.InviteMembers], [byKey["CityLead"].Id], all));
    }

    [Fact]
    public void A_rule_never_lets_a_grantor_give_a_role_carrying_AdministerOrganisation()
    {
        var (all, byKey) = FaithTech();
        byKey["CityLead"].SetGrantableRoles([byKey["SystemAdmin"].Id, byKey["Volunteer"].Id]);

        var grantable = RoleGrantPolicy.Grantable([Capability.AssignRoles], [byKey["CityLead"].Id], all);

        Assert.Equal(["Volunteer"], Keys(grantable, all));
    }

    [Fact]
    public void A_test_defined_organisation_grants_by_its_own_rules_and_an_archived_grantor_gives_nothing()
    {
        var coordinator = Define("Coordinator", Capability.AssignRoles);
        var mentor = Define("Mentor", Capability.AssignRoles);
        var helper = Define("Helper");
        var guest = Define("Guest");
        coordinator.SetGrantableRoles([helper.Id]);
        mentor.SetGrantableRoles([guest.Id]);
        mentor.Archive(DateTime.UtcNow);
        RoleDefinition[] all = [coordinator, mentor, helper, guest];

        var grantable = RoleGrantPolicy.Grantable([Capability.AssignRoles], [coordinator.Id, mentor.Id], all);

        Assert.Equal(["Helper"], Keys(grantable, all));
    }

    [Fact]
    public void An_administrator_acting_under_a_rule_they_hold_is_not_acting_as_administrator()
    {
        var (all, byKey) = FaithTech();
        string[] capabilities = [Capability.AdministerOrganisation, Capability.AssignRoles];
        Guid[] held = [byKey["CityLead"].Id, byKey["SystemAdmin"].Id];

        Assert.False(RoleGrantPolicy.ActsAsAdministrator(capabilities, held, all, byKey["Volunteer"]));
        Assert.True(RoleGrantPolicy.ActsAsAdministrator(capabilities, held, all, byKey["Staff"]));
        Assert.False(RoleGrantPolicy.ActsAsAdministrator([Capability.AssignRoles], [byKey["CityLead"].Id], all, byKey["Volunteer"]));
    }
}
