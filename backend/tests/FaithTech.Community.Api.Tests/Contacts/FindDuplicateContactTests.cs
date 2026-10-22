// Traces to: L2-091, L2-012 (docs/detailed-designs/contacts/possible-duplicate-contact/README.md)
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using static FaithTech.Community.Api.Tests.Contacts.ContactClients;

namespace FaithTech.Community.Api.Tests.Contacts;

/// <summary>
/// The duplicate check looks only at the caller's own contacts, active or archived (L2-091):
/// Given a lead's own contact with an email, when they check that email (any case, any surrounding spaces),
/// then the match is named; given another lead's contact with the email, then the answer is 204.
/// </summary>
public class FindDuplicateContactTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record DuplicateContact(
        Guid Id, string Name, string? Organization, string Email, DateTime AddedAtUtc, int NoteCount, bool IsArchived);

    private static string Url(string email, Guid? excludeId = null) =>
        $"/api/contacts/duplicates?email={Uri.EscapeDataString(email)}" + (excludeId is { } id ? $"&excludeId={id}" : "");

    [Fact]
    public async Task Given_an_own_contact_with_the_email_when_the_lead_checks_a_differently_cased_padded_email_then_it_is_named()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var nadia = await factory.CreateContactAsync(grace, "Nadia Petrov", "nadia@kestrel.example", notes: "Studio director.", organization: "Kestrel Labs");

        var response = await factory.ClientFor(grace, Role.CityLead).GetAsync(Url("  NADIA@Kestrel.Example "));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var match = (await response.Content.ReadFromJsonAsync<DuplicateContact>())!;
        Assert.Equal(
            new DuplicateContact(nadia.Id, "Nadia Petrov", "Kestrel Labs", "nadia@kestrel.example", nadia.CreatedAtUtc, 1, false),
            match);
    }

    [Fact]
    public async Task Given_an_archived_own_contact_with_the_email_when_the_lead_checks_then_it_is_named_as_archived()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ben = await factory.CreateContactAsync(grace, "Ben Carter", "ben@archived.example");
        var client = factory.ClientFor(grace, Role.CityLead);
        await client.PostAsync($"/api/contacts/{ben.Id}/archive", null);

        var match = await client.GetFromJsonAsync<DuplicateContact>(Url("ben@archived.example"));

        Assert.Equal((ben.Id, true), (match!.Id, match.IsArchived));
    }

    [Fact]
    public async Task Given_no_own_contact_with_the_email_when_the_lead_checks_then_the_answer_is_204()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        await factory.CreateContactAsync(grace, "Ben Carter", "ben@elsewhere.example");

        var response = await factory.ClientFor(grace, Role.CityLead).GetAsync(Url("nobody@nowhere.example"));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task Given_a_blank_email_when_the_lead_checks_then_the_answer_is_204()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace, Role.CityLead).GetAsync(Url("   "));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task Given_the_contact_being_edited_when_the_lead_checks_its_own_email_with_exclude_id_then_it_does_not_match_itself()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var tomas = await factory.CreateContactAsync(grace, "Tomás Ruiz", "tomas@edit.example");
        var client = factory.ClientFor(grace, Role.CityLead);

        var self = await client.GetAsync(Url("tomas@edit.example", tomas.Id));
        var second = await factory.CreateContactAsync(grace, "Tomás R.", "tomas@edit.example");
        var other = await client.GetFromJsonAsync<DuplicateContact>(Url("tomas@edit.example", second.Id));

        Assert.Equal(HttpStatusCode.NoContent, self.StatusCode);
        Assert.Equal(tomas.Id, other!.Id);
    }

    [Fact]
    public async Task Given_several_own_contacts_with_the_email_when_the_lead_checks_then_the_oldest_is_named()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var first = await factory.CreateContactAsync(grace, "Abby Brooks", "abby@several.example");
        factory.Time.Advance(TimeSpan.FromDays(1));
        await factory.CreateContactAsync(grace, "Abby B.", "abby@several.example");

        var match = await factory.ClientFor(grace, Role.CityLead).GetFromJsonAsync<DuplicateContact>(Url("abby@several.example"));

        Assert.Equal(first.Id, match!.Id);
    }

    [Fact]
    public async Task Privacy_given_another_lead_owns_a_contact_with_the_email_when_the_lead_checks_then_the_answer_is_204()
    {
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        await factory.CreateContactAsync(marcus, "Kwame Asante", "kwame@private.example");
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace, Role.CityLead).GetAsync(Url("kwame@private.example"));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Privacy_given_a_system_admin_when_they_check_then_only_their_own_contacts_are_compared()
    {
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        await factory.CreateContactAsync(marcus, "Kwame Asante", "kwame@admin-check.example");
        var priya = await factory.AddMemberAsync("Priya Shah");
        var admin = factory.ClientFor(priya, Role.SystemAdmin);

        var another = await admin.GetAsync(Url("kwame@admin-check.example"));
        var created = await admin.PostAsJsonAsync("/api/contacts", NewContact("Lena Fischer", "lena@admin-check.example"));
        var own = (await created.Content.ReadFromJsonAsync<Contact>())!;
        var match = await admin.GetFromJsonAsync<DuplicateContact>(Url("lena@admin-check.example"));

        Assert.Equal(HttpStatusCode.NoContent, another.StatusCode);
        Assert.Equal(own.Id, match!.Id);
    }

    [Fact]
    public async Task Given_an_anonymous_caller_when_they_check_then_the_answer_is_401()
    {
        var response = await factory.CreateClient().GetAsync(Url("nadia@kestrel.example"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData]
    [InlineData(Role.Staff)]
    [InlineData(Role.Volunteer)]
    [InlineData(Role.ProductEngineer)]
    [InlineData(Role.Attendee)]
    public async Task Given_a_member_who_cannot_hold_contacts_when_they_check_then_the_answer_is_403(params Role[] roles)
    {
        var member = await factory.AddMemberAsync("Daniel Reyes");

        var response = await factory.ClientFor(member, roles).GetAsync(Url("nadia@kestrel.example"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
