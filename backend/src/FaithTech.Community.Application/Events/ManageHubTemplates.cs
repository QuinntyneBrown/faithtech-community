using System.Text.Json;
using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Organisations;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>A template as the Hub templates tab lists it (L2-184 AC1, AC3).</summary>
public record HubTemplateSummaryDto(
    Guid Id, string Name, string Description, int SortOrder, bool Archived, DateTime? ArchivedAtUtc, IReadOnlyList<string> Shown, int HubCount);

/// <summary>One section a template holds, with its default content (an Agenda's rows in minutes).</summary>
public record HubTemplateSectionDto(string Kind, bool Visible, JsonElement? Content);

/// <summary>A template as its page reads it (L2-186 AC1): its sections in catalogue order and the organisation's giving facts.</summary>
public record HubTemplateDetailDto(
    Guid Id, string Name, string Description, bool Archived, DateTime? ArchivedAtUtc, int HubCount,
    IReadOnlyList<HubTemplateSectionDto> Sections, HubOrganisationDto Organisation);

/// <summary>Add and rename: a name (60) and an optional description (120).</summary>
public record HubTemplateNameCommand(string? Name, string? Description);

/// <summary>Choose sections: the kinds new hubs show.</summary>
public record HubTemplateSectionsCommand(IReadOnlyList<string>? Shown);

/// <summary>A default Agenda row: minutes from the event's start (ADR 0041).</summary>
public record TemplateAgendaItem(int? Minutes, string? Title, string? Detail);

public record TemplateAgendaContent(IReadOnlyList<TemplateAgendaItem>? Items);

public class TemplateAgendaContentValidator : AbstractValidator<TemplateAgendaContent>
{
    public const int MaxMinutes = 7 * 24 * 60;

    public TemplateAgendaContentValidator()
    {
        RuleFor(x => x.Items).Must(i => i is null || i.Count <= HubContent.MaxAgendaRows).WithMessage("You can add up to 40 rows.");
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.Minutes).NotNull().WithMessage("Enter a time.")
                .InclusiveBetween(0, MaxMinutes).WithMessage("Use a time within a week of the start.");
            item.RuleFor(i => i.Title).Cascade(CascadeMode.Stop)
                .Must(t => !string.IsNullOrWhiteSpace(t)).WithMessage("Say what’s happening.")
                .Must(t => t!.Trim().Length <= 100).WithMessage("Use 100 characters or fewer.");
            item.RuleFor(i => i.Detail).Must(d => d is null || d.Trim().Length <= 200).WithMessage("Use 200 characters or fewer.");
        }).When(x => x.Items is null || x.Items.Count <= HubContent.MaxAgendaRows);
    }
}

/// <summary>
/// Edits the organisation's hub templates in Organisation settings (L2-184 to L2-186, ADR 0043): read with
/// <c>ManageOrganisationSettings</c> or <c>ManageRoles</c>, changed with <c>ManageOrganisationSettings</c> only (403 otherwise);
/// another organisation's template is 404 through the query filter, and an archived one is 404 for every change but Restore.
/// Every change is audited as <c>hub_template.updated</c>. Hubs copy a template when started, so no change reaches a hub.
/// </summary>
public class ManageHubTemplatesHandler(
    IApplicationDbContext db, ICurrentUser current, ICurrentOrganisation organisation, IAuditLog audit, TimeProvider time)
{
    public const string Action = "hub_template.updated";

    public const string FilledOnEachHub = "This section is filled in on each hub.";

    /// <summary>The kinds whose content is typed text a template can default (ADR 0043).</summary>
    public static readonly IReadOnlyList<HubSectionKind> WithDefaults =
    [
        HubSectionKind.Hero, HubSectionKind.Agenda, HubSectionKind.WhatToBring, HubSectionKind.Tracks, HubSectionKind.Process,
        HubSectionKind.Rules, HubSectionKind.DemoFormat, HubSectionKind.Judging, HubSectionKind.Worship, HubSectionKind.Giving,
        HubSectionKind.UpcomingEvents,
    ];

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private bool CanRead => current.Has(Capability.ManageOrganisationSettings) || current.Has(Capability.ManageRoles);

    private Result? Refusal() =>
        !current.Has(Capability.ManageOrganisationSettings) || current.Membership is null ? Result.Forbidden() : null;

    public async Task<(Result Result, IReadOnlyList<HubTemplateSummaryDto>? Templates)> ListAsync(
        bool archived, CancellationToken cancellationToken = default)
    {
        if (!CanRead)
        {
            return (Result.Forbidden(), null);
        }

        var templates = await db.HubTemplates.Where(t => (t.ArchivedAtUtc != null) == archived)
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Name).ToListAsync(cancellationToken);
        var counts = await HubCountsAsync(cancellationToken);
        return (Result.Ok(), [.. templates.Select(t => Summary(t, counts))]);
    }

    public async Task<(Result Result, HubTemplateDetailDto? Template)> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (!CanRead)
        {
            return (Result.Forbidden(), null);
        }

        return await db.HubTemplates.SingleOrDefaultAsync(t => t.Id == id, cancellationToken) is { } template
            ? (Result.Ok(), await DetailAsync(template, cancellationToken))
            : (Result.NotFound(), null);
    }

    public async Task<(Result Result, HubTemplateSummaryDto? Template)> AddAsync(
        HubTemplateNameCommand command, CancellationToken cancellationToken = default)
    {
        if ((Refusal() ?? await NameRefusalAsync(command, null, cancellationToken)) is { } refused)
        {
            return (refused, null);
        }

        var last = await db.HubTemplates.Where(t => t.ArchivedAtUtc == null).MaxAsync(t => (int?)t.SortOrder, cancellationToken);
        var sections = HubTemplateSections.Write([.. HubSectionKinds.Core.Select(kind => new HubTemplateSection(kind, true, null))]);
        var template = new HubTemplate(Guid.NewGuid(), command.Name!.Trim(), command.Description ?? string.Empty, (last ?? 0) + 1, sections);
        db.HubTemplates.Add(template);
        Audit(template, null);
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), Summary(template, new Dictionary<string, int>()));
    }

    public async Task<(Result Result, HubTemplateSummaryDto? Template)> RenameAsync(
        Guid id, HubTemplateNameCommand command, CancellationToken cancellationToken = default)
    {
        if (Refusal() is { } refused)
        {
            return (refused, null);
        }

        if (await ActiveAsync(id, cancellationToken) is not { } template)
        {
            return (Result.NotFound(), null);
        }

        if (await NameRefusalAsync(command, id, cancellationToken) is { } invalid)
        {
            return (invalid, null);
        }

        var before = Snapshot(template);
        template.Describe(command.Name!, command.Description ?? string.Empty);
        Audit(template, before);
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), Summary(template, await HubCountsAsync(cancellationToken)));
    }

    /// <summary>
    /// Shown kinds become visible, the rest hidden, defaults kept; an optional kind hidden without a default is dropped (L2-186 AC2).
    /// </summary>
    public async Task<(Result Result, HubTemplateDetailDto? Template)> SetSectionsAsync(
        Guid id, HubTemplateSectionsCommand command, CancellationToken cancellationToken = default)
    {
        if (Refusal() is { } refused)
        {
            return (refused, null);
        }

        if (await ActiveAsync(id, cancellationToken) is not { } template)
        {
            return (Result.NotFound(), null);
        }

        var names = command.Shown ?? [];
        var kinds = new List<HubSectionKind>();
        foreach (var name in names)
        {
            if (!EventHubRules.TryParseKind(name, out var kind) || kinds.Contains(kind))
            {
                return (Result.Invalid("shown", "Choose sections from the list."), null);
            }

            kinds.Add(kind);
        }

        if (kinds.Count == 0)
        {
            return (Result.Invalid("shown", "Tick at least one section."), null);
        }

        var before = Snapshot(template);
        var held = HubTemplateSections.Read(template).ToDictionary(s => s.Kind);
        var sections = Enum.GetValues<HubSectionKind>()
            .Select(kind => new HubTemplateSection(kind, kinds.Contains(kind), held.GetValueOrDefault(kind)?.Content))
            .Where(s => HubSectionKinds.IsCore(s.Kind) || s.Visible || s.Content is not null)
            .ToList();
        template.ReplaceSections(HubTemplateSections.Write(sections));
        Audit(template, before);
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await DetailAsync(template, cancellationToken));
    }

    /// <summary>
    /// Saves one section's default (L2-186 AC3 to AC5): validated with the hub's schema and messages, an Agenda in minutes. A kind
    /// the template didn't hold joins it, shown.
    /// </summary>
    public async Task<Result> SaveDefaultAsync(Guid id, string kindName, JsonElement body, CancellationToken cancellationToken = default)
    {
        if (Refusal() is { } refused)
        {
            return refused;
        }

        if (await ActiveAsync(id, cancellationToken) is not { } template || !EventHubRules.TryParseKind(kindName, out var kind))
        {
            return Result.NotFound();
        }

        if (!WithDefaults.Contains(kind))
        {
            return Result.Invalid("kind", FilledOnEachHub);
        }

        var (content, errors) = kind == HubSectionKind.Agenda ? ParseAgenda(body) : Parse(kind, body);
        if (errors is not null)
        {
            return new Result(ResultStatus.Invalid, errors);
        }

        var before = Snapshot(template);
        var sections = HubTemplateSections.Read(template).ToList();
        var index = sections.FindIndex(s => s.Kind == kind);
        if (index >= 0)
        {
            sections[index] = sections[index] with { Content = content };
        }
        else
        {
            sections.Add(new HubTemplateSection(kind, true, content));
        }

        template.ReplaceSections(HubTemplateSections.Write(sections));
        audit.Record(current.Membership!.ProfileId, Action, "HubTemplate", template.Id.ToString(), before,
            new { template.Name, Section = kind.ToString() });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    public async Task<(Result Result, HubTemplateSummaryDto? Template)> ArchiveAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (Refusal() is { } refused)
        {
            return (refused, null);
        }

        if (await ActiveAsync(id, cancellationToken) is not { } template)
        {
            return (Result.NotFound(), null);
        }

        var before = Snapshot(template);
        template.Archive(time.GetUtcNow().UtcDateTime);
        Audit(template, before);
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), Summary(template, await HubCountsAsync(cancellationToken)));
    }

    /// <summary>Puts an archived template back at the end (L2-185 AC5); 409 when an active template now has its name.</summary>
    public async Task<(Result Result, HubTemplateSummaryDto? Template)> RestoreAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (Refusal() is { } refused)
        {
            return (refused, null);
        }

        if (await db.HubTemplates.SingleOrDefaultAsync(t => t.Id == id && t.ArchivedAtUtc != null, cancellationToken) is not { } template)
        {
            return (Result.NotFound(), null);
        }

        var lower = template.Name.ToLower();
        if (await db.HubTemplates.AnyAsync(t => t.ArchivedAtUtc == null && t.Name.ToLower() == lower, cancellationToken))
        {
            return (Result.Conflict($"There’s already a template called {template.Name}. Rename it first."), null);
        }

        var before = Snapshot(template);
        var last = await db.HubTemplates.Where(t => t.ArchivedAtUtc == null).MaxAsync(t => (int?)t.SortOrder, cancellationToken);
        template.Restore((last ?? 0) + 1);
        Audit(template, before);
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), Summary(template, await HubCountsAsync(cancellationToken)));
    }

    private Task<HubTemplate?> ActiveAsync(Guid id, CancellationToken cancellationToken) =>
        db.HubTemplates.SingleOrDefaultAsync(t => t.Id == id && t.ArchivedAtUtc == null, cancellationToken);

    private async Task<Result?> NameRefusalAsync(HubTemplateNameCommand command, Guid? except, CancellationToken cancellationToken)
    {
        var name = command.Name?.Trim() ?? string.Empty;
        if (name.Length == 0)
        {
            return Result.Invalid("name", "Enter a name.");
        }

        if (name.Length > HubTemplate.NameMaxLength)
        {
            return Result.Invalid("name", $"Use {HubTemplate.NameMaxLength} characters or fewer.");
        }

        if ((command.Description?.Trim().Length ?? 0) > HubTemplate.DescriptionMaxLength)
        {
            return Result.Invalid("description", $"Use {HubTemplate.DescriptionMaxLength} characters or fewer.");
        }

        var lower = name.ToLower();
        var taken = await db.HubTemplates.AnyAsync(
            t => t.ArchivedAtUtc == null && t.Id != except && t.Name.ToLower() == lower, cancellationToken);
        return taken ? Result.Invalid("name", $"There’s already a template called {name}.") : null;
    }

    private static (JsonElement? Content, IReadOnlyDictionary<string, string[]>? Errors) Parse(HubSectionKind kind, JsonElement body)
    {
        var (content, errors) = HubContent.Parse(kind, body);
        return errors is not null
            ? (null, errors)
            : (JsonSerializer.SerializeToElement(content, HubContent.ContentType(kind), HubContent.Json), null);
    }

    private static (JsonElement? Content, IReadOnlyDictionary<string, string[]>? Errors) ParseAgenda(JsonElement body)
    {
        TemplateAgendaContent? agenda;
        try
        {
            agenda = body.ValueKind == JsonValueKind.Object ? body.Deserialize<TemplateAgendaContent>(HubContent.Json) : null;
        }
        catch (JsonException)
        {
            agenda = null;
        }

        if (agenda is null)
        {
            return (null, new Dictionary<string, string[]> { ["content"] = ["Check this section’s fields."] });
        }

        var result = new TemplateAgendaContentValidator().Validate(agenda);
        if (!result.IsValid)
        {
            return (null, HubContent.Errors(result));
        }

        static string? Text(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        var rows = (agenda.Items ?? []).Select(i => new { minutes = i.Minutes!.Value, title = Text(i.Title), detail = Text(i.Detail) });
        return (JsonSerializer.SerializeToElement(new { items = rows }, Json), null);
    }

    private Task<Dictionary<string, int>> HubCountsAsync(CancellationToken cancellationToken) =>
        db.EventHubs.GroupBy(h => h.TemplateKey)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, cancellationToken);

    private async Task<HubTemplateDetailDto> DetailAsync(HubTemplate t, CancellationToken cancellationToken)
    {
        var org = await db.Organisations.AsNoTracking().SingleAsync(o => o.Id == organisation.Id, cancellationToken);
        var counts = await HubCountsAsync(cancellationToken);
        return new HubTemplateDetailDto(
            t.Id, t.Name, t.Description, t.IsArchived, t.ArchivedAtUtc, counts.GetValueOrDefault(t.Id.ToString()),
            [.. HubTemplateSections.Read(t).Select(s => new HubTemplateSectionDto(s.Kind.ToString(), s.Visible, s.Content))],
            new HubOrganisationDto(org.Name, org.ShortName, org.GivingLink, org.GivingText));
    }

    private static HubTemplateSummaryDto Summary(HubTemplate t, IReadOnlyDictionary<string, int> counts) =>
        new(t.Id, t.Name, t.Description, t.SortOrder, t.IsArchived, t.ArchivedAtUtc,
            [.. HubTemplateSections.Read(t).Where(s => s.Visible).Select(s => s.Kind.ToString())],
            counts.GetValueOrDefault(t.Id.ToString()));

    private static object Snapshot(HubTemplate t) => new
    {
        t.Name,
        t.Description,
        Archived = t.IsArchived,
        Shown = HubTemplateSections.Read(t).Where(s => s.Visible).Select(s => s.Kind.ToString()),
    };

    private void Audit(HubTemplate template, object? before) =>
        audit.Record(current.Membership!.ProfileId, Action, "HubTemplate", template.Id.ToString(), before, Snapshot(template));
}
