// Traces to: L2-002, L2-015
using FaithTech.Community.Domain.Identity;

namespace FaithTech.Community.Application.Tests.Domain.Identity;

public class EmailVerifiedTests
{
    [Fact]
    public void The_event_names_the_profile_and_the_verified_email()
    {
        var profileId = Guid.NewGuid();

        var verified = new EmailVerified(profileId, "ada@example.org");

        Assert.Equal((profileId, "ada@example.org"), (verified.ProfileId, verified.Email));
    }

    [Fact]
    public void The_event_needs_an_email()
    {
        Assert.Throws<ArgumentException>(() => new EmailVerified(Guid.NewGuid(), ""));
    }
}
