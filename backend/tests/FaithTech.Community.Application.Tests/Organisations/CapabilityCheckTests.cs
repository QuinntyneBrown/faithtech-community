using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Tests.Organisations;

// Traces to: L2-135 AC2, AC3.
public class CapabilityCheckTests
{
    private sealed class Caller(params string[] capabilities) : ICurrentUser
    {
        public Guid? UserId => Guid.NewGuid();

        public CurrentMembership? Membership { get; } =
            new(Guid.NewGuid(), [], capabilities.ToHashSet(StringComparer.Ordinal));

        public IReadOnlyCollection<Role> Roles => [];

        public bool IsAuthenticated => true;

        public bool HasRole(Role role) => false;
    }

    [Fact]
    public void A_caller_holds_exactly_the_capabilities_of_their_roles()
    {
        ICurrentUser caller = new Caller(Capability.ManageEvents);

        Assert.True(caller.Has(Capability.ManageEvents));
        Assert.False(caller.Has(Capability.ManagePartners));
    }

    [Fact]
    public void An_administrator_holds_every_capability()
    {
        ICurrentUser caller = new Caller(Capability.AdministerOrganisation);

        Assert.All(Capability.All, c => Assert.True(caller.Has(c.Key)));
    }

    [Fact]
    public void A_caller_with_no_membership_holds_nothing()
    {
        ICurrentUser caller = new Caller();

        Assert.False(caller.Has(Capability.ManageEvents));
    }

    [Fact]
    public void The_catalogue_knows_only_its_own_keys()
    {
        Assert.True(Capability.IsKnown(Capability.ViewReports));
        Assert.False(Capability.IsKnown("viewreports"));
        Assert.False(Capability.IsKnown("ManageHackathons"));
    }
}
