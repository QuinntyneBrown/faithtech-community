namespace FaithTech.Community.Api.Tests;

/// <summary>
/// FaithTech's seeded roles as tests name them (L2-151 AC5): each value is the key of the seeded definition. The code under
/// test never names a role; only tests arrange FaithTech's roles as the regression case.
/// </summary>
public enum Role
{
    CityLead,
    EventLead,
    CreateLead,
    CommunicationsLead,
    Staff,
    Volunteer,
    ProductEngineer,
    Attendee,
    SystemAdmin,
}
