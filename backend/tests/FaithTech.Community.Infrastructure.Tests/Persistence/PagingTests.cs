using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Infrastructure.Tests.Persistence;

public class PagingTests : IAsyncLifetime
{
    private readonly string _database = Guid.NewGuid().ToString();

    public async Task InitializeAsync()
    {
        await using var db = CreateContext();
        db.Profiles.AddRange(Enumerable.Range(1, 130).Select(i => new Profile($"Member {i:000}")));
        await db.SaveChangesAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Returns_the_requested_page_and_the_total_count()
    {
        await using var db = CreateContext();

        var page = await db.Profiles.OrderBy(p => p.Name).Select(p => p.Name).ToPagedResultAsync(new PageRequest(2, 50));

        Assert.Equal(130, page.TotalCount);
        Assert.Equal((2, 50), (page.Page, page.PageSize));
        Assert.Equal(50, page.Items.Count);
        Assert.Equal("Member 051", page.Items[0]);
    }

    [Fact]
    public async Task Never_returns_more_than_100_items()
    {
        await using var db = CreateContext();

        var page = await db.Profiles.OrderBy(p => p.Name).ToPagedResultAsync(new PageRequest(1, 1000));

        Assert.Equal(100, page.Items.Count);
    }

    private CommunityDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<CommunityDbContext>().UseInMemoryDatabase(_database).UseOpenIddict().Options);
}
