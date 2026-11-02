using FaithTech.Community.Domain.Events;
using FluentValidation;

namespace FaithTech.Community.Application.Events;

// The ten optional kinds' content (L2-173 to L2-182, ADR 0042): only what the lead types; partners and files are read live.

/// <summary>A titled line with an optional detail, as several kinds list them.</summary>
public record HubTitledItem(string? Title, string? Detail);

public record ParkingOption(string? Title, string? Notes, Guid? MapResourceId);

public record ParkingContent(string? Note, IReadOnlyList<ParkingOption>? Options);

public record WhatToBringContent(IReadOnlyList<string?>? Bring, IReadOnlyList<HubTitledItem>? OnTheDay);

public record PartnersContent(IReadOnlyList<Guid>? PartnerIds, string? Meet);

public record HubTrack(string? Title, string? Brief, string? LinkUrl, string? LinkText, bool Primary);

public record TracksContent(IReadOnlyList<HubTrack>? Tracks, IReadOnlyList<HubTitledItem>? GoodLooksLike);

public record ProcessStage(string? Title, string? When, string? Summary, IReadOnlyList<HubTitledItem>? Points);

public record ProcessContent(string? Name, string? Intro, IReadOnlyList<ProcessStage>? Stages);

public record RulesContent(IReadOnlyList<HubTitledItem>? Rules, string? Note);

public record DemoSegment(string? Title, string? Detail, int? Seconds);

public record DemoFormatContent(int? Minutes, int? QuestionMinutes, IReadOnlyList<DemoSegment>? Segments, IReadOnlyList<string?>? Tips);

public record JudgingCriterion(string? Title, string? Question, string? TopMark, int? Weight);

public record JudgingHonor(string? Title, string? Line, string? ChosenBy);

public record JudgingContent(int? TopScore, IReadOnlyList<JudgingCriterion>? Criteria, IReadOnlyList<JudgingHonor>? Honors, string? Note);

public record WorshipSong(string? Title, string? Artist, string? Url);

public record WorshipContent(string? Note, IReadOnlyList<WorshipSong>? Songs);

public record HubSlide(Guid? ResourceId);

public record SlidesContent(IReadOnlyList<HubSlide>? Slides);

/// <summary>The house rules every wizard shows on its step: lengths, required text and list limits.</summary>
internal static class HubRuleBuilders
{
    public static IRuleBuilderOptions<T, string?> Within<T>(this IRuleBuilder<T, string?> rule, int max) =>
        rule.Must(v => v is null || v.Trim().Length <= max).WithMessage($"Use {max} characters or fewer.");

    public static IRuleBuilderOptions<T, string?> Required<T>(this IRuleBuilder<T, string?> rule, string message, int max) =>
        rule.Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage(message)
            .Must(v => v is null || v.Trim().Length <= max).WithMessage($"Use {max} characters or fewer.");

    public static IRuleBuilderOptions<T, IReadOnlyList<TItem>?> AtMost<T, TItem>(this IRuleBuilder<T, IReadOnlyList<TItem>?> rule, int max, string what) =>
        rule.Must(list => list is null || list.Count <= max).WithMessage($"You can add up to {max} {what}.");

    public static IRuleBuilderOptions<T, string?> Https<T>(this IRuleBuilder<T, string?> rule) =>
        rule.Must(HubContent.IsHttpsOrEmpty).WithMessage(HubContent.HttpsMessage);
}

public class ParkingContentValidator : AbstractValidator<ParkingContent>
{
    public ParkingContentValidator()
    {
        RuleFor(x => x.Note).Within(300);
        RuleFor(x => x.Options).AtMost(6, "options");
        RuleForEach(x => x.Options).ChildRules(o =>
        {
            o.RuleFor(i => i.Title).Required("Name this option.", 80);
            o.RuleFor(i => i.Notes).Within(300);
        });
    }
}

public class WhatToBringContentValidator : AbstractValidator<WhatToBringContent>
{
    public WhatToBringContentValidator()
    {
        RuleFor(x => x.Bring).AtMost(15, "things to bring");
        RuleForEach(x => x.Bring).Required("Say what to bring.", 120);
        RuleFor(x => x.OnTheDay).AtMost(10, "items");
        RuleForEach(x => x.OnTheDay).ChildRules(i =>
        {
            i.RuleFor(d => d.Title).Required("Give this a title.", 60);
            i.RuleFor(d => d.Detail).Within(160);
        });
    }
}

public class PartnersContentValidator : AbstractValidator<PartnersContent>
{
    public PartnersContentValidator()
    {
        RuleFor(x => x.PartnerIds).Must(p => p is null || p.Distinct().Count() <= 6).WithMessage("You can pick up to 6 partners.");
        RuleFor(x => x.Meet).Within(400);
    }
}

public class TracksContentValidator : AbstractValidator<TracksContent>
{
    public TracksContentValidator()
    {
        RuleFor(x => x.Tracks).AtMost(6, "tracks")
            .Must(t => t is null || t.Count(track => track.Primary) <= 1).WithMessage("Mark one track as primary.");
        RuleForEach(x => x.Tracks).ChildRules(t =>
        {
            t.RuleFor(i => i.Title).Required("Name this track.", 80);
            t.RuleFor(i => i.Brief).Required("Add the track’s brief.", 400);
            t.RuleFor(i => i.LinkUrl).Https();
            t.RuleFor(i => i.LinkText).Within(60);
        });
        RuleFor(x => x.GoodLooksLike).AtMost(6, "marks");
        RuleForEach(x => x.GoodLooksLike).ChildRules(g =>
        {
            g.RuleFor(i => i.Title).Required("Give this a title.", 60);
            g.RuleFor(i => i.Detail).Within(160);
        });
    }
}

public class ProcessContentValidator : AbstractValidator<ProcessContent>
{
    public ProcessContentValidator()
    {
        RuleFor(x => x.Name).Within(60);
        RuleFor(x => x.Intro).Within(300);
        RuleFor(x => x.Stages).AtMost(8, "stages");
        RuleForEach(x => x.Stages).ChildRules(s =>
        {
            s.RuleFor(i => i.Title).Required("Name this stage.", 40);
            s.RuleFor(i => i.When).Within(40);
            s.RuleFor(i => i.Summary).Within(160);
            s.RuleFor(i => i.Points).AtMost(6, "points");
            s.RuleForEach(i => i.Points).ChildRules(p =>
            {
                p.RuleFor(i => i.Title).Required("Give this point a title.", 40);
                p.RuleFor(i => i.Detail).Within(160);
            });
        });
    }
}

public class RulesContentValidator : AbstractValidator<RulesContent>
{
    public RulesContentValidator()
    {
        RuleFor(x => x.Rules).AtMost(12, "rules");
        RuleForEach(x => x.Rules).ChildRules(r =>
        {
            r.RuleFor(i => i.Title).Required("Name this rule.", 60);
            r.RuleFor(i => i.Detail).Within(160);
        });
        RuleFor(x => x.Note).Within(300);
    }
}

public class DemoFormatContentValidator : AbstractValidator<DemoFormatContent>
{
    public DemoFormatContentValidator()
    {
        RuleFor(x => x.Minutes).InclusiveBetween(1, 30).WithMessage("Choose between 1 and 30 minutes.").When(x => x.Minutes is not null);
        RuleFor(x => x.QuestionMinutes).InclusiveBetween(0, 30).WithMessage("Choose between 0 and 30 minutes.")
            .When(x => x.QuestionMinutes is not null);
        RuleFor(x => x.Segments).AtMost(8, "segments")
            .Must((content, segments) => content.Minutes is not int minutes || minutes < 1 || minutes > 30 || Total(segments) <= minutes * 60)
            .WithMessage(content => $"The segments run {HubContent.Clock(Total(content.Segments))}. Make them fit in {HubContent.Minutes(content.Minutes!.Value)}.");
        RuleForEach(x => x.Segments).ChildRules(s =>
        {
            s.RuleFor(i => i.Title).Required("Name this segment.", 60);
            s.RuleFor(i => i.Detail).Within(120);
            s.RuleFor(i => i.Seconds).NotNull().WithMessage("Choose how long it runs.")
                .InclusiveBetween(15, 1800).WithMessage("Choose between 15 and 1800 seconds.");
        });
        RuleFor(x => x.Tips).AtMost(5, "tips");
        RuleForEach(x => x.Tips).Required("Write the tip.", 80);
    }

    private static int Total(IReadOnlyList<DemoSegment>? segments) => segments?.Sum(s => s.Seconds ?? 0) ?? 0;
}

public class JudgingContentValidator : AbstractValidator<JudgingContent>
{
    public static readonly string[] ChosenBy = ["TopScore", "JudgesPick", "MentorsPick", "Vote"];

    public JudgingContentValidator()
    {
        RuleFor(x => x.TopScore).InclusiveBetween(3, 10).WithMessage("Choose between 3 and 10.").When(x => x.TopScore is not null);
        RuleFor(x => x.Criteria).AtMost(6, "criteria")
            .Must(c => c is null || c.Count == 0 || Total(c) == 100)
            .WithMessage(content => $"Weights add up to {Total(content.Criteria)}%. Make them total 100%.");
        RuleForEach(x => x.Criteria).ChildRules(c =>
        {
            c.RuleFor(i => i.Title).Required("Name this criterion.", 60);
            c.RuleFor(i => i.Question).Within(200);
            c.RuleFor(i => i.TopMark).Within(200);
            c.RuleFor(i => i.Weight).NotNull().WithMessage("Give it a weight.")
                .InclusiveBetween(1, 100).WithMessage("Choose between 1 and 100.");
        });
        RuleFor(x => x.Honors).AtMost(6, "honors");
        RuleForEach(x => x.Honors).ChildRules(h =>
        {
            h.RuleFor(i => i.Title).Required("Name this honor.", 60);
            h.RuleFor(i => i.Line).Within(160);
            h.RuleFor(i => i.ChosenBy).Must(v => ChosenBy.Contains(v ?? string.Empty, StringComparer.OrdinalIgnoreCase))
                .WithMessage("Choose how it’s chosen.");
        });
        RuleFor(x => x.Note).Within(200);
    }

    private static int Total(IReadOnlyList<JudgingCriterion>? criteria) => criteria?.Sum(c => c.Weight ?? 0) ?? 0;
}

public class WorshipContentValidator : AbstractValidator<WorshipContent>
{
    public WorshipContentValidator()
    {
        RuleFor(x => x.Note).Within(200);
        RuleFor(x => x.Songs).AtMost(10, "songs");
        RuleForEach(x => x.Songs).ChildRules(s =>
        {
            s.RuleFor(i => i.Title).Required("Name the song.", 80);
            s.RuleFor(i => i.Artist).Within(80);
            s.RuleFor(i => i.Url).Https();
        });
    }
}

public class SlidesContentValidator : AbstractValidator<SlidesContent>
{
    public SlidesContentValidator()
    {
        RuleFor(x => x.Slides).AtMost(60, "slides");
        RuleForEach(x => x.Slides).ChildRules(s => s.RuleFor(i => i.ResourceId).NotNull().WithMessage("Choose a PDF or an image."));
    }
}

public static partial class HubContent
{
    /// <summary>Reads stored content as its kind's record; anything unreadable reads as the kind's defaults.</summary>
    public static object ReadAs(HubSectionKind kind, string? content)
    {
        var type = ContentType(kind);
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize(string.IsNullOrWhiteSpace(content) ? "{}" : content, type, Json)
                ?? System.Text.Json.JsonSerializer.Deserialize("{}", type, Json)!;
        }
        catch (System.Text.Json.JsonException)
        {
            return System.Text.Json.JsonSerializer.Deserialize("{}", type, Json)!;
        }
    }

    /// <summary>"3:30": a length in seconds as minutes and seconds.</summary>
    public static string Clock(int seconds) => $"{seconds / 60}:{seconds % 60:00}";

    /// <summary>"3 minutes", or "1 minute".</summary>
    public static string Minutes(int minutes) => minutes == 1 ? "1 minute" : $"{minutes} minutes";

    /// <summary>Whether an optional section has what visitors need: at least one item (L2-172 AC5).</summary>
    private static bool OptionalReady(HubSectionKind kind, string content) => kind switch
    {
        HubSectionKind.Parking => Read<ParkingContent>(content).Options is { Count: > 0 },
        HubSectionKind.WhatToBring => Read<WhatToBringContent>(content) is var w && (w.Bring is { Count: > 0 } || w.OnTheDay is { Count: > 0 }),
        HubSectionKind.Partners => Read<PartnersContent>(content).PartnerIds is { Count: > 0 },
        HubSectionKind.Tracks => Read<TracksContent>(content).Tracks is { Count: > 0 },
        HubSectionKind.Process => Read<ProcessContent>(content).Stages is { Count: > 0 },
        HubSectionKind.Rules => Read<RulesContent>(content).Rules is { Count: > 0 },
        HubSectionKind.DemoFormat => Read<DemoFormatContent>(content).Segments is { Count: > 0 },
        HubSectionKind.Judging => Read<JudgingContent>(content) is var j && (j.Criteria is { Count: > 0 } || j.Honors is { Count: > 0 }),
        HubSectionKind.Worship => Read<WorshipContent>(content).Songs is { Count: > 0 },
        HubSectionKind.Slides => Read<SlidesContent>(content).Slides is { Count: > 0 },
        _ => false,
    };

    private static List<HubTitledItem> Items(IReadOnlyList<HubTitledItem>? items) =>
        [.. (items ?? []).Select(i => new HubTitledItem(Text(i.Title), Text(i.Detail)))];

    /// <summary>Trims the optional kinds' text and drops empty text.</summary>
    private static object NormaliseOptional(object content) => content switch
    {
        ParkingContent c => new ParkingContent(Text(c.Note), [.. (c.Options ?? []).Select(o => new ParkingOption(Text(o.Title), Text(o.Notes), o.MapResourceId))]),
        WhatToBringContent c => new WhatToBringContent([.. (c.Bring ?? []).Select(Text)], Items(c.OnTheDay)),
        PartnersContent c => new PartnersContent([.. (c.PartnerIds ?? []).Distinct()], Text(c.Meet)),
        TracksContent c => new TracksContent(
            [.. (c.Tracks ?? []).Select(t => new HubTrack(Text(t.Title), Text(t.Brief), Text(t.LinkUrl), Text(t.LinkText), t.Primary))],
            Items(c.GoodLooksLike)),
        ProcessContent c => new ProcessContent(Text(c.Name), Text(c.Intro),
            [.. (c.Stages ?? []).Select(s => new ProcessStage(Text(s.Title), Text(s.When), Text(s.Summary), Items(s.Points)))]),
        RulesContent c => new RulesContent(Items(c.Rules), Text(c.Note)),
        DemoFormatContent c => new DemoFormatContent(c.Minutes, c.QuestionMinutes,
            [.. (c.Segments ?? []).Select(s => new DemoSegment(Text(s.Title), Text(s.Detail), s.Seconds))], [.. (c.Tips ?? []).Select(Text)]),
        JudgingContent c => new JudgingContent(c.TopScore,
            [.. (c.Criteria ?? []).Select(x => new JudgingCriterion(Text(x.Title), Text(x.Question), Text(x.TopMark), x.Weight))],
            [.. (c.Honors ?? []).Select(h => new JudgingHonor(Text(h.Title), Text(h.Line),
                JudgingContentValidator.ChosenBy.First(v => string.Equals(v, h.ChosenBy, StringComparison.OrdinalIgnoreCase))))],
            Text(c.Note)),
        WorshipContent c => new WorshipContent(Text(c.Note), [.. (c.Songs ?? []).Select(s => new WorshipSong(Text(s.Title), Text(s.Artist), Text(s.Url)))]),
        SlidesContent c => new SlidesContent([.. (c.Slides ?? []).Select(s => new HubSlide(s.ResourceId))]),
        _ => content,
    };

    /// <summary>The resources a Parking or Slides section names, for the hub's file endpoint (L2-182 AC3).</summary>
    public static IReadOnlyList<Guid> ResourceIds(HubSectionKind kind, string content) => kind switch
    {
        HubSectionKind.Parking => [.. (Read<ParkingContent>(content).Options ?? []).Where(o => o.MapResourceId is not null).Select(o => o.MapResourceId!.Value)],
        HubSectionKind.Slides => [.. (Read<SlidesContent>(content).Slides ?? []).Where(s => s.ResourceId is not null).Select(s => s.ResourceId!.Value)],
        _ => [],
    };
}
