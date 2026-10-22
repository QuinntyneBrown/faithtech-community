namespace FaithTech.Community.Application.Reports;

/// <summary>The whole report in one response (docs/detailed-designs/reports/reports-dashboard); City is null for All cities.</summary>
public record ReportDto(
    string? City,
    string Period,
    DateTimeOffset? From,
    DateTimeOffset To,
    IReadOnlyList<string> Cities,
    bool IsEmpty,
    ReportFiguresDto Figures,
    IReadOnlyList<ReportChartRowDto> MembersByCity,
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

public record PartnerPipelineRowDto(string City, int Lead, int InFunnel, int Confirmed);

/// <summary>
/// Status is Held, Upcoming or Cancelled. Going, CheckedIn and CheckedInPercent are null for a cancelled event;
/// CheckedIn and CheckedInPercent for an upcoming one; CheckedInPercent when Going is 0. Walk-ins are excluded.
/// </summary>
public record ReportEventRowDto(
    Guid Id, string Title, DateTimeOffset StartsAt, string City, string Status, int? Going, int? CheckedIn, int? CheckedInPercent);
