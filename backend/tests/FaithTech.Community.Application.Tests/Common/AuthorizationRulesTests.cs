using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Application.Tests.Common;

// Traces to: L2-135 AC5. An override is an action allowed only because the actor holds AdministerOrganisation.
public class AuthorizationRulesTests
{
    [Fact]
    public void An_administrator_without_the_capability_overrides()
    {
        Assert.True(AuthorizationRules.IsOverride(new CallerStub(Capability.AdministerOrganisation), Capability.ManageEvents));
    }

    [Fact]
    public void An_administrator_who_also_holds_the_capability_does_not_override()
    {
        Assert.False(AuthorizationRules.IsOverride(
            new CallerStub(Capability.AdministerOrganisation, Capability.ManageEvents), Capability.ManageEvents));
    }

    [Fact]
    public void A_holder_of_the_capability_does_not_override()
    {
        Assert.False(AuthorizationRules.IsOverride(new CallerStub(Capability.ManageEvents), Capability.ManageEvents));
    }

    [Fact]
    public void A_caller_without_either_does_not_override()
    {
        Assert.False(AuthorizationRules.IsOverride(new CallerStub(Capability.ViewAttendees), Capability.ManageEvents));
    }
}
