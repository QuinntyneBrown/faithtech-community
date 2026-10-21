using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace FaithTech.Community.Infrastructure.Persistence;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<CommunityDbContext>
{
    public CommunityDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<CommunityDbContext>()
            .UseNpgsql("Host=localhost;Database=faithtech_community")
            .UseOpenIddict()
            .Options);
}
