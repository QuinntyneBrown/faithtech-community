using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Infrastructure.Email;
using FaithTech.Community.Infrastructure.Organisations;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Api.Tests.Organisations;

// Traces to: L2-130 AC6, L2-134 AC5. An email goes out in the name of the organisation it was sent in: the product
// name in its subject and body, its action button and footer, its sender display name, and every link, the
// unsubscribe link included, on that organisation's host. FaithTech's emails read as before.
public partial class OrganisationEmailTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task An_invite_from_another_organisation_names_it_and_links_to_its_host()
    {
        var northside = await factory.AddOrganisationAsync();
        var ana = await factory.AddMemberAsync(northside, "Ana Lima", Role.CityLead);
        var email = $"{Guid.NewGuid():N}@example.org";

        (await factory.ClientOn(northside, ana).PostAsJsonAsync("/api/invites", new { Email = email })).EnsureSuccessStatusCode();

        var message = Assert.Single(await factory.QueuedEmailsToAsync(northside.Id, email));
        Assert.Equal("Ana Lima invited you to northside community", message.Subject);
        Assert.Contains("Ana Lima invited you to join northside community.", message.Body);
        Assert.DoesNotContain("FaithTech", message.Body + message.Subject + message.HtmlBody);
        AssertLinksOn(northside.Origin, message);
        Assert.Contains(">Open in northside</a>", message.HtmlBody);
        Assert.Contains(">northside community</p>", message.HtmlBody);
    }

    [Fact]
    public async Task A_faithtech_invite_reads_as_before()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = $"{Guid.NewGuid():N}@example.org";

        (await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync("/api/invites", new { Email = email })).EnsureSuccessStatusCode();

        var message = Assert.Single(await factory.QueuedEmailsToAsync(email));
        Assert.Equal("Grace Okonkwo invited you to FaithTech Community", message.Subject);
        AssertLinksOn(CommunityApiFactory.WebAppOrigin, message);
        Assert.Contains(">Open in FaithTech</a>", message.HtmlBody);
        Assert.Contains(">FaithTech Community</p>", message.HtmlBody);
    }

    [Fact]
    public async Task An_announcement_email_and_its_unsubscribe_link_are_on_the_organisations_host()
    {
        var northside = await factory.AddOrganisationAsync();
        var lead = await factory.AddMemberAsync(northside, "Ana Lima", Role.CommunicationsLead);
        var member = await factory.AddMemberAsync(northside, "Bea Costa");
        var address = await factory.WithDbAsync(northside.Id, db => db.Users.Where(u => u.ProfileId == member.ProfileId).Select(u => u.Email!).SingleAsync());

        (await factory.ClientOn(northside, lead).PostAsJsonAsync("/api/announcements",
            new { Subject = "Launch night", Body = "Doors at six.", AlsoEmail = true, Audience = new { Kind = "Everyone" } })).EnsureSuccessStatusCode();

        var message = Assert.Single(await factory.QueuedEmailsToAsync(northside.Id, address));
        Assert.Contains($"{northside.Origin}/unsubscribe?token=", message.Body);
        AssertLinksOn(northside.Origin, message);
    }

    [Fact]
    public async Task A_verification_email_for_a_sign_up_on_another_host_names_that_organisation()
    {
        var northside = await factory.AddOrganisationAsync();
        var client = factory.CreateClient();
        client.BaseAddress = new Uri(northside.Origin);
        var email = $"{Guid.NewGuid():N}@example.org";

        (await client.PostAsJsonAsync("/api/account/sign-up", new { name = "Cal Lima", email, password = "a-long-enough-passphrase" })).EnsureSuccessStatusCode();

        var message = Assert.Single(factory.Emails.SentTo(email));
        Assert.Equal("Verify your northside community email", message.Subject);
        AssertLinksOn(northside.Origin, message);
    }

    [Fact]
    public async Task The_sender_display_name_is_the_organisations_name()
    {
        var northside = await factory.AddOrganisationAsync();
        var transport = new RecordingTransport();
        var app = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s => s.AddSingleton<IEmailTransport>(transport)));
        foreach (var (organisationId, to) in new[] { (northside.Id, "ana@northside.test"), (FaithTechSeed.OrganisationId, "grace@faithtech.test") })
        {
            await using var scope = app.Services.CreateOrganisationScope(organisationId);
            scope.ServiceProvider.GetRequiredService<IEmailQueue>().Enqueue(new EmailMessage(to, "Hello", "Hi"));
            await scope.ServiceProvider.GetRequiredService<Infrastructure.Persistence.CommunityDbContext>().SaveChangesAsync();
        }

        await app.Services.GetRequiredService<OrganisationWork>().ForEachAsync(
            (services, ct) => services.GetRequiredService<EmailOutboxDispatcher>().DispatchPendingAsync(ct));

        Assert.Equal("northside community", transport.Sent["ana@northside.test"].FromName);
        Assert.Equal("FaithTech Community", transport.Sent["grace@faithtech.test"].FromName);
    }

    private static void AssertLinksOn(string origin, EmailMessage message)
    {
        var links = Url().Matches(message.Body + "\n" + message.HtmlBody).Select(m => m.Value).ToList();
        Assert.NotEmpty(links);
        Assert.All(links, link => Assert.StartsWith(origin + "/", link));
    }

    [GeneratedRegex("https?://[^\\s\"<]+")]
    private static partial Regex Url();

    private sealed class RecordingTransport : IEmailTransport
    {
        public ConcurrentDictionary<string, EmailMessage> Sent { get; } = new();

        public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
        {
            Sent[message.To] = message;
            return Task.CompletedTask;
        }
    }
}
