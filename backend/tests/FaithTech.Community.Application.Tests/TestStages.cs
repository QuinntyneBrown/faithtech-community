using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Application.Tests;

/// <summary>Partner stages arranged as FaithTech's seed defines them (L2-151 AC3): Lead (initial), In Funnel and Confirmed.</summary>
public static class TestStages
{
    public static readonly PartnerStage Lead = new(Guid.NewGuid(), "lead", "Lead", 1, isInitial: true);
    public static readonly PartnerStage InFunnel = new(Guid.NewGuid(), "in-funnel", "In Funnel", 2);
    public static readonly PartnerStage Confirmed = new(Guid.NewGuid(), "confirmed", "Confirmed", 3, kind: PartnerStageKind.Confirmed);

    public static PartnerStage Of(string key) => new[] { Lead, InFunnel, Confirmed }.Single(s => s.Key == key);
}
