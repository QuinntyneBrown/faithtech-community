using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Admin;

/// <summary>Display names for roles in summaries and emails, matching the web app's labels.</summary>
public static class RoleLabels
{
    public static string Of(Role role) => role switch
    {
        Role.CityLead => "City Lead",
        Role.EventLead => "Event Lead",
        Role.CreateLead => "Create Lead",
        Role.CommunicationsLead => "Communications Lead",
        Role.ProductEngineer => "Product Engineer",
        Role.SystemAdmin => "System Admin",
        _ => role.ToString(),
    };
}
