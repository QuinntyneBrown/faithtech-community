using FaithTech.Community.Application.Common;

namespace FaithTech.Community.Application.Tests.Common;

public class PageRequestTests
{
    [Theory]
    [InlineData(500, 100)]
    [InlineData(100, 100)]
    [InlineData(25, 25)]
    [InlineData(0, 1)]
    public void Page_size_is_clamped_between_1_and_100(int requested, int expected)
    {
        Assert.Equal(expected, new PageRequest(1, requested).PageSize);
    }

    [Fact]
    public void Page_number_is_at_least_1()
    {
        Assert.Equal(1, new PageRequest(-3, 10).Page);
    }

    [Fact]
    public void Defaults_to_the_first_page_of_25()
    {
        var request = new PageRequest();

        Assert.Equal((1, 25), (request.Page, request.PageSize));
    }
}
