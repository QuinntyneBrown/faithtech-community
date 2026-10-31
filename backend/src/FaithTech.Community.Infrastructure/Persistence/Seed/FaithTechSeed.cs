using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Infrastructure.Persistence.Seed;

/// <summary>
/// The FaithTech organisation and the records the seed gives it, with fixed ids so that the migrations and the seeder
/// agree (docs/detailed-designs/organisations/seed-faithtech, L2-151). The only place FaithTech's names appear.
/// </summary>
public static class FaithTechSeed
{
    public static readonly Guid OrganisationId = new("0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b6c01");

    public const string Slug = "faithtech";

    public const string Host = "app.faithtech.community";

    public const string Name = "FaithTech Community";

    public const string ShortName = "FaithTech";

    public const string ChapterLabelSingular = "City";

    public const string ChapterLabelPlural = "Cities";

    /// <summary>The creation time the first migration records for the row.</summary>
    public static readonly DateTime CreatedAtUtc = new(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc);

    public static Organisation Organisation()
    {
        var organisation = new Organisation(OrganisationId, Slug, Host, Name, ShortName, CreatedAtUtc);
        organisation.SetChapterLabel(ChapterLabelSingular, ChapterLabelPlural);
        return organisation;
    }
}
