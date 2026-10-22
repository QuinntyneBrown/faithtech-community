// Traces to: L2-104 (docs/detailed-designs/reports/reports-dashboard, ADR 0026)
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Profiles;
using static FaithTech.Community.Api.Tests.Reports.ReportClients;

namespace FaithTech.Community.Api.Tests.Reports;

/// <summary>
/// L2-104: Given 10,000 members, 1,000 events and thousands of RSVPs, when the report and the export are asked for,
/// then they answer with the right totals, computed as aggregates. The in-memory provider cannot prove latency or SQL
/// shape: the 1-second p95 budget is checked by the load test against PostgreSQL (eng/load-test.js, reports scenario).
/// </summary>
public class ReportVolumeTests : IAsyncLifetime
{
    private static readonly string[] Cities = ["Austin", "Calgary", "Halifax", "Toronto", "Vancouver", "Winnipeg"];

    private CommunityApiFactory factory = null!;

    public async Task InitializeAsync() => factory = await NewFactoryAsync();

    public Task DisposeAsync() => factory.DisposeAsync();

    [Fact]
    public async Task The_report_and_export_answer_with_the_right_totals_at_volume()
    {
        var staff = await factory.StaffAsync();
        var profiles = Enumerable.Range(0, 10_000)
            .Select(i => (Profile: Member($"Member {i:00000}", Cities[i % Cities.Length], Now.AddDays(-(i % 540))), Verified: i % 50 != 0))
            .ToList();
        var events = Enumerable.Range(0, 1_000).Select(i => Event(i)).ToList();
        await factory.WithDbAsync(async db =>
        {
            foreach (var (profile, verified) in profiles)
            {
                var email = $"{profile.Id:N}@example.org";
                db.Profiles.Add(profile);
                db.Users.Add(new CommunityUser
                {
                    Id = Guid.NewGuid(), UserName = email, Email = email, NormalizedEmail = email.ToUpperInvariant(),
                    NormalizedUserName = email.ToUpperInvariant(), EmailConfirmed = verified, ProfileId = profile.Id,
                });
            }

            db.Events.AddRange(events);
            return await db.SaveChangesAsync();
        });
        var from = Now.AddDays(-90);
        var held = events.Where(e => !e.IsCancelled && e.StartsAt >= from && e.StartsAt <= Now).ToList();
        var rsvps = held.SelectMany(e => e.Rsvps).Where(r => !r.IsWalkIn).ToList();
        var toronto = profiles.Where(p => p.Verified && p.Profile.HomeCity == "Toronto").ToList();

        var all = await staff.ReportAsync("?period=last-90-days");
        var city = await staff.ReportAsync("?city=Toronto&period=all-time");
        var export = await staff.GetAsync("/api/reports/export.csv?period=this-year");

        Assert.Equal(profiles.Count(p => p.Verified) + 1, all.Figures.Members.Value);
        Assert.Equal(profiles.Count(p => p.Verified && p.Profile.JoinedAtUtc >= from.UtcDateTime), all.Figures.Members.NewInPeriod);
        Assert.Equal(held.Count, all.Figures.EventsHeld.Value);
        Assert.Equal(rsvps.Count, all.Figures.Rsvps.Value);
        Assert.Equal(rsvps.Count(r => r.CheckedInAt != null), all.Figures.Rsvps.CheckedIn);
        Assert.Equal(Cities, all.Cities);
        Assert.Equal(50, all.Events.Length);
        Assert.Equal(toronto.Count, city.Figures.Members.Value);
        Assert.Equal(12, city.NewMembersByMonth.Length);
        Assert.Equal(toronto.Count(p => p.Profile.JoinedAtUtc >= new DateTime(2030, 4, 1, 0, 0, 0, DateTimeKind.Utc)),
            city.NewMembersByMonth.Sum(m => m.Value));
        Assert.Equal(System.Net.HttpStatusCode.OK, export.StatusCode);
    }

    private static Profile Member(string name, string city, DateTimeOffset joinedAt)
    {
        var profile = new Profile(name, joinedAt.UtcDateTime);
        profile.Update(name, city, null);
        return profile;
    }

    /// <summary>Events over the last 400 days and the next 30, every 20th cancelled, 3 RSVPs each, 2 checked in.</summary>
    private static Event Event(int i)
    {
        var starts = Now.AddDays(30 - (i * 430 / 1_000.0));
        var e = new Event(
            $"Night {i:0000}", "About the night.", EventType.Gathering, starts, starts.AddHours(2), Cities[i % Cities.Length],
            EventFormat.InPerson, "Kestrel Labs", null, null, EventVisibility.MembersOnly, Guid.NewGuid());
        var taken = Enumerable.Range(0, 3).Select(r => e.Rsvp(Guid.NewGuid(), starts.AddDays(-2).AddMinutes(r))).ToList();
        if (starts <= Now)
        {
            foreach (var rsvp in taken.Take(2))
            {
                e.CheckIn(rsvp.Id, Guid.NewGuid(), starts);
            }

            if (i % 7 == 0)
            {
                e.AddWalkIn("Walk-in", null, null, true, Guid.NewGuid(), starts);
            }
        }

        if (i % 20 == 0)
        {
            e.Cancel("Venue fell through");
        }

        return e;
    }
}
