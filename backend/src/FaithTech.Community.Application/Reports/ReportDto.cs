namespace FaithTech.Community.Application.Reports;

/// <summary>
/// The whole report in one response (docs/detailed-designs/reports/reports-dashboard). Chapter is null for All
/// {chapters}; Chapters lists the active chapters for the filter, empty while chapters are off, as is MembersByChapter.
/// </summary>
public record ReportDto(
    Guid? Chapter,
    string? ChapterName,
    string Period,
    DateTimeOffset? From,
    DateTimeOffset To,
    IReadOnlyList<ReportChapterDto> Chapters,
    bool IsEmpty,
    ReportFiguresDto Figures,
    IReadOnlyList<ReportChartRowDto> MembersByChapter,
    IReadOnlyList<ReportMonthRowDto> NewMembersByMonth,
    IReadOnlyList<PartnerPipelineRowDto> PartnerPipeline,
    IReadOnlyList<ReportEventRowDto> Events);

public record ReportFiguresDto(
    MembersFigureDto Members,
    EventsHeldFigureDto EventsHeld,
    RsvpsFigureDto Rsvps,
    PartnersFigureDto PartnersConfirmed,
    AnnouncementsFigureDto Announcements);

/// <summary>NewInPeriod is null for All time, where every member would be new.</summary>
public record MembersFigureDto(int Value, int? NewInPeriod);

public record EventsHeldFigureDto(int Value, int Cancelled);

/// <summary>CheckedInPercent is null when there are no RSVPs.</summary>
public record RsvpsFigureDto(int Value, int CheckedIn, int? CheckedInPercent);

public record PartnersFigureDto(int Value, int InPipeline);

public record AnnouncementsFigureDto(int Value);

public record ReportChartRowDto(string Label, int Value);

/// <summary>Month is "yyyy-MM"; SoFar marks the current month.</summary>
public record ReportMonthRowDto(string Month, string Label, int Value, bool SoFar);

/// <summary>An active chapter the report can be filtered by (L2-142 AC1).</summary>
public record ReportChapterDto(Guid Id, string Name);

/// <summary>Chapter names the row: a chapter, "No {chapter}", or "Partner pipeline" while chapters are off.</summary>
public record PartnerPipelineRowDto(string Chapter, int Lead, int InFunnel, int Confirmed);

/// <summary>
/// Status is Held, Upcoming or Cancelled. Going, CheckedIn and CheckedInPercent are null for a cancelled event;
/// CheckedIn and CheckedInPercent for an upcoming one; CheckedInPercent when Going is 0. Walk-ins are excluded.
/// Chapter is the event's chapter or "{Organisation}-wide", and null while chapters are off.
/// </summary>
public record ReportEventRowDto(
    Guid Id, string Title, DateTimeOffset StartsAt, string? Chapter, string Status, int? Going, int? CheckedIn, int? CheckedInPercent);
