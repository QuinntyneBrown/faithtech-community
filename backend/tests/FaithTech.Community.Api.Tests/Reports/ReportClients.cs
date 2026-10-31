using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Announcements;
using FaithTech.Community.Domain.Contacts;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Partners;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Reports;

/// <summary>
/// Report data stored straight in the database, relative to a fixed clock, and the shape <c>GET /api/reports</c>
/// answers with (docs/detailed-designs/reports/reports-dashboard).
/// </summary>
public static class ReportClients
{
    /// <summary>15 March 2031, 12:00 UTC: Last 30 days is 13 February to now, so its months are Feb and Mar.</summary>
    public static readonly DateTimeOffset Now = new(2031, 3, 15, 12, 0, 0, TimeSpan.Zero);

    public sealed record MembersFigure(int Value, int? NewInPeriod);

    public sealed record EventsHeldFigure(int Value, int Cancelled);

    public sealed record RsvpsFigure(int Value, int CheckedIn, int? CheckedInPercent);

    public sealed record PartnersFigure(int Value, int InPipeline);

    public sealed record AnnouncementsFigure(int Value);

    public sealed record Figures(
        MembersFigure Members, EventsHeldFigure EventsHeld, RsvpsFigure Rsvps, PartnersFigure PartnersConfirmed, AnnouncementsFigure Announcements);

    public sealed record ChartRow(string Label, int Value);

    public sealed record MonthRow(string Month, string Label, int Value, bool SoFar);

    public sealed record PipelineRow(string City, int Lead, int InFunnel, int Confirmed);

    public sealed record EventRow(
        Guid Id, string Title, DateTimeOffset StartsAt, string City, string Status, int? Going, int? CheckedIn, int? CheckedInPercent);

    public sealed record Report(
        string? City,
        string Period,
        DateTimeOffset? From,
        DateTimeOffset To,
        string[] Cities,
        bool IsEmpty,
        Figures Figures,
        ChartRow[] MembersByCity,
        MonthRow[] NewMembersByMonth,
        PipelineRow[] PartnerPipeline,
        EventRow[] Events);

    /// <summary>A new factory on the fixed clock: report figures are global, so each test needs its own data set.</summary>
    public static async Task<CommunityApiFactory> NewFactoryAsync()
    {
        var factory = new CommunityApiFactory();
        await factory.InitializeAsync();
        factory.Time.SetUtcNow(Now);
        return factory;
    }

    /// <summary>A Staff member to read the report as: a verified member with no home city, so counted under "Other".</summary>
    public static async Task<HttpClient> StaffAsync(this CommunityApiFactory factory, Role role = Role.Staff) =>
        factory.ClientFor(await factory.AddMemberAsync("Sam Staff"), role);

    public static async Task<Report> ReportAsync(this HttpClient client, string query = "")
    {
        var response = await client.GetAsync($"/api/reports{query}");
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<Report>())!;
    }

    /// <summary>A member with a home city, joined at the given time (or with no recorded join time).</summary>
    public static Task<ProfileClients.Member> AddCityMemberAsync(
        this CommunityApiFactory factory,
        string name,
        string? city,
        DateTimeOffset? joinedAt = null,
        bool verified = true,
        bool suspended = false) =>
        factory.WithDbAsync(async db =>
        {
            var profile = new Profile(name, joinedAt?.UtcDateTime);
            profile.Update(name, city, null);
            if (suspended)
            {
                profile.Suspend("Spam", Now.UtcDateTime);
            }

            var email = $"{Guid.NewGuid():N}@example.org";
            var user = new Application.Identity.CommunityUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                Email = email,
                NormalizedEmail = email.ToUpperInvariant(),
                NormalizedUserName = email.ToUpperInvariant(),
                EmailConfirmed = verified,
            };
            profile.LinkAccount(user.Id);
            db.Profiles.Add(profile);
            db.Users.Add(user);
            await db.SaveChangesAsync();
            return new ProfileClients.Member(user.Id, profile.Id);
        });

    /// <summary>
    /// An event starting at <paramref name="startsAt"/> with <paramref name="rsvps"/> member RSVPs, the first
    /// <paramref name="checkedIn"/> of them checked in, and <paramref name="walkIns"/> checked-in walk-ins.
    /// </summary>
    public static Task<Event> AddReportEventAsync(
        this CommunityApiFactory factory,
        string title,
        DateTimeOffset startsAt,
        string city = "Toronto",
        int rsvps = 0,
        int checkedIn = 0,
        int walkIns = 0,
        bool cancelled = false) =>
        factory.WithDbAsync(async db =>
        {
            var e = new Event(
                title, $"About {title}.", EventType.Gathering, startsAt, startsAt.AddHours(2), city, EventFormat.InPerson,
                "Kestrel Labs", null, null, EventVisibility.MembersOnly, Guid.NewGuid());
            var taken = new List<Rsvp>();
            for (var i = 0; i < rsvps; i++)
            {
                taken.Add(e.Rsvp(Guid.NewGuid(), startsAt.AddDays(-7).AddMinutes(i)));
            }

            foreach (var rsvp in taken.Take(checkedIn))
            {
                e.CheckIn(rsvp.Id, Guid.NewGuid(), startsAt);
            }

            for (var i = 0; i < walkIns; i++)
            {
                e.AddWalkIn($"Walk-in {i}", null, null, true, Guid.NewGuid(), startsAt);
            }

            if (cancelled)
            {
                e.Cancel("Venue fell through");
            }

            db.Events.Add(e);
            await db.SaveChangesAsync();
            return e;
        });

    public static Task<Partner> AddReportPartnerAsync(
        this CommunityApiFactory factory, string name, Guid? ownerId, PartnerStage stage = PartnerStage.Lead, Guid? mergedInto = null) =>
        factory.WithDbAsync(async db =>
        {
            var partner = new Partner(name, null, null, ownerId, null, null, null, null, stage);
            if (mergedInto is { } kept)
            {
                partner.ArchiveAsMergedInto(kept, Guid.NewGuid(), Now.UtcDateTime);
            }

            db.Partners.Add(partner);
            await db.SaveChangesAsync();
            return partner;
        });

    public static Task AddAnnouncementAsync(this CommunityApiFactory factory, Guid senderId, DateTimeOffset sentAt) =>
        factory.WithDbAsync(async db =>
        {
            db.Announcements.Add(new Announcement("Builders Night", "See you there.", AnnouncementAudience.Everyone(), senderId, sentAt, false));
            return await db.SaveChangesAsync();
        });

    /// <summary>A lead's private contact with a note, in the given city.</summary>
    public static Task AddPrivateContactAsync(this CommunityApiFactory factory, Guid ownerId, string name, string email, string city) =>
        factory.WithDbAsync(async db =>
        {
            var contact = new Contact(ownerId, name, email, "416-555-0100", "Kestrel Labs", city, Now.UtcDateTime);
            contact.AddNote("Met at Builders Night; wants to host.", Now.UtcDateTime);
            db.Contacts.Add(contact);
            return await db.SaveChangesAsync();
        });

    public static Task<int> CountAsync<T>(this CommunityApiFactory factory, Func<Application.Common.IApplicationDbContext, IQueryable<T>> set) =>
        factory.WithDbAsync(db => set(db).CountAsync());
}
