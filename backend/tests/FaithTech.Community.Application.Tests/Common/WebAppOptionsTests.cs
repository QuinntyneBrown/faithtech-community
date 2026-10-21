// Traces to: L2-028 AC2
using FaithTech.Community.Application.Common;

namespace FaithTech.Community.Application.Tests.Common;

public class WebAppOptionsTests
{
    // Every link in an email is built from the origin, so it must be HTTPS; local development is the exception.
    [Theory]
    [InlineData("https://community.faithtech.com", true)]
    [InlineData("https://app.faithtech.test", true)]
    [InlineData("http://localhost:4200", true)]
    [InlineData("http://127.0.0.1:4200", true)]
    [InlineData("http://community.faithtech.com", false)]
    [InlineData("ftp://community.faithtech.com", false)]
    [InlineData("community.faithtech.com", false)]
    [InlineData("", false)]
    public void Links_need_an_https_origin_except_on_this_machine(string origin, bool allowed)
    {
        Assert.Equal(allowed, WebAppOptions.IsSafeLinkOrigin(origin));
    }
}
