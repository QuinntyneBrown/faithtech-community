using System.Globalization;
using System.Text;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Partners;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Partners;

public enum DuplicateReason
{
    Website,
    Name,
}

/// <summary>The normalised keys one partner is compared on (ADR 0027).</summary>
public record PartnerKey(Guid Id, string? Host, string? Name)
{
    public static PartnerKey From(Guid id, string? name, string? website) =>
        new(id, PartnerDuplicateRules.NormaliseHost(website), PartnerDuplicateRules.NormaliseName(name));
}

/// <summary>
/// The possible-duplicate rule (L2-113, ADR 0027): exact matches on normalised website hosts, then
/// on normalised names. Email and its domain are never compared. Pure, so it is tested on its own.
/// </summary>
public static class PartnerDuplicateRules
{
    private static readonly string[] Suffixes = ["inc", "incorporated", "ltd", "limited", "llc", "corp", "corporation", "co", "company"];

    /// <summary>The host only: no scheme, port, path, query or fragment; lowercase; one leading www. and a trailing dot removed.</summary>
    public static string? NormaliseHost(string? website)
    {
        var trimmed = website?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return null;
        }

        var withScheme = trimmed.Contains("://", StringComparison.Ordinal) ? trimmed : $"http://{trimmed}";
        if (!Uri.TryCreate(withScheme, UriKind.Absolute, out var uri) || string.IsNullOrEmpty(uri.Host))
        {
            return null;
        }

        var host = uri.Host.ToLowerInvariant();
        if (host.StartsWith("www.", StringComparison.Ordinal))
        {
            host = host[4..];
        }

        host = host.TrimEnd('.');
        return host.Length == 0 ? null : host;
    }

    /// <summary>Accents folded, lowercase, punctuation and symbols deleted, whitespace collapsed, one trailing company suffix removed.</summary>
    public static string? NormaliseName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return null;
        }

        var folded = new StringBuilder();
        foreach (var c in name.Normalize(NormalizationForm.FormD))
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(c);
            if (category == UnicodeCategory.NonSpacingMark || char.IsPunctuation(c) || char.IsSymbol(c))
            {
                continue;
            }

            folded.Append(char.ToLowerInvariant(c));
        }

        var words = folded.ToString().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).ToList();
        if (words.Count > 1 && Suffixes.Contains(words[^1]))
        {
            words.RemoveAt(words.Count - 1);
        }

        return words.Count == 0 ? null : string.Join(' ', words);
    }

    /// <summary>Website when both hosts are present and equal, else Name when both names are, else no match.</summary>
    public static DuplicateReason? Match(PartnerKey a, PartnerKey b)
    {
        if (a.Host is not null && a.Host == b.Host)
        {
            return DuplicateReason.Website;
        }

        if (a.Name is not null && a.Name == b.Name)
        {
            return DuplicateReason.Name;
        }

        return null;
    }
}

/// <summary>One possible duplicate. MatchedOn is the shared host, or the other partner's name as written.</summary>
public record PartnerDuplicateDto(Guid Id, string Name, string Reason, string MatchedOn, string? AddedByName, DateOnly? AddedOn);

public record PartnerDuplicatesDto(IReadOnlyList<PartnerDuplicateDto> Matches);

/// <summary>Finds a partner's possible duplicates and stores "Not the same" (L2-113).</summary>
public class PartnerDuplicatesHandler(IApplicationDbContext db, PartnerAccess access, TimeProvider time)
{
    public async Task<(Result Result, PartnerDuplicatesDto? Duplicates)> ListAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (!access.CanRead)
        {
            return (Result.Forbidden(), null);
        }

        var partner = await db.Partners.AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => new { p.Id, p.Name, p.Website, p.ArchivedAtUtc })
            .SingleOrDefaultAsync(cancellationToken);
        if (partner is null)
        {
            return (Result.NotFound(), null);
        }

        if (partner.ArchivedAtUtc is not null)
        {
            return (Result.Ok(), new PartnerDuplicatesDto([]));
        }

        // Every active partner's id, name and website; archived partners are never offered (AC8).
        var others = await db.Partners.AsNoTracking()
            .Where(p => p.Id != id && p.ArchivedAtUtc == null)
            .Select(p => new { p.Id, p.Name, p.Website })
            .ToListAsync(cancellationToken);
        var key = PartnerKey.From(partner.Id, partner.Name, partner.Website);
        var matches = others
            .Select(o => (Other: o, Key: PartnerKey.From(o.Id, o.Name, o.Website)))
            .Select(o => (o.Other, o.Key, Reason: PartnerDuplicateRules.Match(key, o.Key)))
            .Where(o => o.Reason is not null)
            .ToList();
        if (matches.Count == 0)
        {
            return (Result.Ok(), new PartnerDuplicatesDto([]));
        }

        var ids = matches.Select(m => m.Other.Id).ToList();
        var dismissed = await db.PartnerDuplicateDismissals.AsNoTracking()
            .Where(d => (d.LowerPartnerId == id && ids.Contains(d.HigherPartnerId)) || (d.HigherPartnerId == id && ids.Contains(d.LowerPartnerId)))
            .Select(d => d.LowerPartnerId == id ? d.HigherPartnerId : d.LowerPartnerId)
            .ToListAsync(cancellationToken);
        matches = [.. matches.Where(m => !dismissed.Contains(m.Other.Id))];
        var added = (await db.PartnerActivities.AsNoTracking()
                .Where(a => a.Kind == PartnerActivityKind.Added && ids.Contains(a.PartnerId))
                .Select(a => new { a.PartnerId, a.LoggedById, a.OccurredOn, a.LoggedAtUtc })
                .ToListAsync(cancellationToken))
            .GroupBy(a => a.PartnerId)
            .ToDictionary(g => g.Key, g => g.OrderBy(a => a.LoggedAtUtc).First());
        var people = added.Values.Select(a => a.LoggedById).Distinct().ToList();
        var names = await db.Profiles.AsNoTracking().Where(p => people.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Name, cancellationToken);
        var result = matches
            .OrderBy(m => m.Other.Name, StringComparer.CurrentCultureIgnoreCase)
            .ThenBy(m => m.Other.Id)
            .Select(m =>
            {
                var entry = added.GetValueOrDefault(m.Other.Id);
                return new PartnerDuplicateDto(
                    m.Other.Id,
                    m.Other.Name,
                    m.Reason!.Value.ToString(),
                    m.Reason == DuplicateReason.Website ? m.Key.Host! : m.Other.Name,
                    entry is null ? null : names.GetValueOrDefault(entry.LoggedById),
                    entry?.OccurredOn);
            })
            .ToList();
        return (Result.Ok(), new PartnerDuplicatesDto(result));
    }

    /// <summary>"Not the same": one dismissal per pair, whichever partner it was chosen from (AC6, AC7).</summary>
    public async Task<Result> DismissAsync(Guid id, Guid otherId, CancellationToken cancellationToken = default)
    {
        if (!access.CanWrite)
        {
            return Result.Forbidden();
        }

        if (id == otherId)
        {
            return Result.Invalid("otherId", "Choose two different partners.");
        }

        var pair = await db.Partners.AsNoTracking().Where(p => p.Id == id || p.Id == otherId).ToListAsync(cancellationToken);
        var partner = pair.SingleOrDefault(p => p.Id == id);
        var other = pair.SingleOrDefault(p => p.Id == otherId);
        if (partner is null || other is null)
        {
            return Result.NotFound();
        }

        if (pair.FirstOrDefault(p => p.IsArchived) is { } archived)
        {
            return Result.Conflict($"{archived.Name} has already been merged.");
        }

        var actor = await access.CallerProfileIdAsync(cancellationToken);
        var dismissal = PartnerDuplicateDismissal.For(id, otherId, actor, time.GetUtcNow().UtcDateTime);
        var exists = await db.PartnerDuplicateDismissals.AnyAsync(
            d => d.LowerPartnerId == dismissal.LowerPartnerId && d.HigherPartnerId == dismissal.HigherPartnerId, cancellationToken);
        if (exists)
        {
            return Result.Ok();
        }

        db.PartnerDuplicateDismissals.Add(dismissal);
        access.AuditAdminWrite(actor, partner, "partner.duplicate.dismissed", null, new { OtherId = other.Id, OtherName = other.Name });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}
