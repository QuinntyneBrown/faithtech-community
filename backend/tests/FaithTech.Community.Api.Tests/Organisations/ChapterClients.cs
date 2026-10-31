using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Infrastructure.Persistence;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

/// <summary>Chapters stored directly, in FaithTech unless another organisation is named.</summary>
public static class ChapterClients
{
    public sealed record AddedChapter(Guid Id, string Name);

    /// <summary>The chapter with this name, added at the end of the list the first time it is asked for.</summary>
    public static Task<AddedChapter> AddChapterAsync(
        this CommunityApiFactory factory, string name, bool archived = false, Guid? organisationId = null) =>
        factory.WithDbAsync(organisationId ?? FaithTechSeed.OrganisationId, async db =>
        {
            var chapter = await db.FindOrAddChapterAsync(name);
            if (archived)
            {
                chapter.Archive(DateTime.UtcNow);
            }

            await db.SaveChangesAsync();
            return new AddedChapter(chapter.Id, chapter.Name);
        });

    /// <summary>The active chapter with this name in the context's organisation, added (unsaved) when there is none.</summary>
    public static async Task<Chapter> FindOrAddChapterAsync(this CommunityDbContext db, string name)
    {
        var normalized = Chapter.Normalize(name);
        var chapter = db.Chapters.Local.SingleOrDefault(c => c.NormalizedName == normalized && c.ArchivedAtUtc == null)
            ?? await db.Chapters.SingleOrDefaultAsync(c => c.NormalizedName == normalized && c.ArchivedAtUtc == null);
        if (chapter is null)
        {
            chapter = new Chapter(name.Trim(), await db.Chapters.CountAsync() + db.Chapters.Local.Count);
            db.Chapters.Add(chapter);
        }

        return chapter;
    }

    /// <summary>The id of the chapter with this name, added (unsaved) when there is none; null for no name.</summary>
    public static async Task<Guid?> ChapterIdAsync(this CommunityDbContext db, string? name) =>
        string.IsNullOrWhiteSpace(name) ? null : (await db.FindOrAddChapterAsync(name)).Id;

    /// <summary>The id of the chapter with this name, adding it when there is none; null for no name.</summary>
    public static async Task<Guid?> ChapterIdAsync(this CommunityApiFactory factory, string? name, Guid? organisationId = null) =>
        string.IsNullOrWhiteSpace(name) ? null : (await factory.AddChapterAsync(name.Trim(), organisationId: organisationId)).Id;
}
