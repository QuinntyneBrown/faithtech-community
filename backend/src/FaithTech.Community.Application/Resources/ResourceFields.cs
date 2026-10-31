using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Domain.Resources;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Resources;

/// <summary>The fields a resource is added or edited with, as the client sent them.</summary>
public record ResourceFieldsInput(
    string? Title,
    string? Description,
    string? Type,
    IReadOnlyList<string>? Tags,
    string? Visibility,
    IReadOnlyList<Guid>? MemberIds,
    IReadOnlyList<string>? Roles);

/// <summary>The fields once checked: the title may still be empty when it comes from each file's name.</summary>
public record ResourceFields(string? Title, string? Description, ResourceType? Type, IReadOnlyList<string> Tags, ResourceAudience Audience);

/// <summary>The field rules shared by the add and edit dialogs and the API (L2-059).</summary>
public class ResourceFieldRules(IApplicationDbContext db)
{
    public const string TitleMessage = "Give it a title so people can find it.";
    public const string AudienceMessage = "Choose at least one person or role, or pick another visibility.";

    /// <param name="titleRequired">False for uploads, where a missing title comes from the file name.</param>
    public async Task<(ResourceFields? Fields, Dictionary<string, string[]> Errors)> CheckAsync(
        ResourceFieldsInput input, bool titleRequired, CancellationToken cancellationToken = default)
    {
        var errors = new Dictionary<string, string[]>();
        var title = input.Title?.Trim();
        if (string.IsNullOrEmpty(title))
        {
            if (titleRequired)
            {
                errors["Title"] = [TitleMessage];
            }

            title = null;
        }
        else if (title.Length > Resource.MaxTitle)
        {
            errors["Title"] = [$"Use {Resource.MaxTitle} characters or fewer for the title."];
        }

        var description = input.Description?.Trim();
        if (description is { Length: > Resource.MaxDescription })
        {
            errors["Description"] = [$"Use {Resource.MaxDescription:N0} characters or fewer for the description."];
        }

        ResourceType? type = null;
        if (!string.IsNullOrWhiteSpace(input.Type) || titleRequired)
        {
            if (IsName<ResourceType>(input.Type, out var parsed))
            {
                type = parsed;
            }
            else
            {
                errors["Type"] = ["Choose a type."];
            }
        }

        var tags = Resource.NormaliseTags(input.Tags);
        if (tags.Any(t => t.Length > Resource.MaxTag))
        {
            errors["Tags"] = [$"Keep each tag to {Resource.MaxTag} characters or fewer."];
        }

        var audience = await AudienceAsync(input, errors, cancellationToken);
        return errors.Count > 0 ? (null, errors) : (new ResourceFields(title, description, type, tags, audience!), errors);
    }

    private async Task<ResourceAudience?> AudienceAsync(ResourceFieldsInput input, Dictionary<string, string[]> errors, CancellationToken cancellationToken)
    {
        var visibility = string.IsNullOrWhiteSpace(input.Visibility) ? nameof(ResourceVisibility.Global) : input.Visibility;
        if (!IsName<ResourceVisibility>(visibility, out var parsed))
        {
            errors["Visibility"] = ["Choose who can see it."];
            return null;
        }

        if (parsed != ResourceVisibility.Shared)
        {
            return parsed == ResourceVisibility.Private ? ResourceAudience.Private() : ResourceAudience.Global();
        }

        var roles = await RoleKeys.DefinitionsAsync(db, input.Roles ?? [], cancellationToken);
        if (roles is null || !roles.All(RoleKeys.IsShareable))
        {
            errors["Roles"] = ["Choose roles from the list."];
            return null;
        }

        var members = (input.MemberIds ?? []).Distinct().ToList();
        if (members.Count > 0 && await db.Profiles.CountAsync(p => members.Contains(p.Id), cancellationToken) != members.Count)
        {
            errors["MemberIds"] = ["Choose members who are on FaithTech."];
            return null;
        }

        if (members.Count == 0 && roles.Count == 0)
        {
            errors["Visibility"] = [AudienceMessage];
            return null;
        }

        return ResourceAudience.Shared(members, roles);
    }

    private static bool IsName<T>(string? value, out T parsed) where T : struct, Enum =>
        Enum.TryParse(value, ignoreCase: false, out parsed) && !int.TryParse(value, out _) && Enum.IsDefined(parsed);
}

public static class ResourceResults
{
    public static Result Invalid(Dictionary<string, string[]> errors) => new(ResultStatus.Invalid, errors);
}
