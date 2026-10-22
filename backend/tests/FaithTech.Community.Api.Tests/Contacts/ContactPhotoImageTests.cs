// Traces to: L2-070, L2-072
using System.Net;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Contacts.ContactClients;

namespace FaithTech.Community.Api.Tests.Contacts;

public class ContactPhotoImageTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task The_owner_fetches_the_stored_image_from_its_url()
    {
        var (client, contact) = await OwnContact();
        var photo = await client.AddContactPhotoAsync(contact.Id);

        var response = await client.GetAsync(photo.Url);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/jpeg", response.Content.Headers.ContentType?.MediaType);
        Assert.True(response.Headers.CacheControl?.Private);
        var key = await factory.WithDbAsync(async db => (await db.Contacts.AsNoTracking().SingleAsync(c => c.Id == contact.Id)).Photos.Single().BlobName);
        Assert.Equal(factory.Photos.Blobs[key].Content, await response.Content.ReadAsByteArrayAsync());
    }

    public static TheoryData<string, Role[]> Outsiders() => new()
    {
        { "another lead", [Role.CityLead] },
        { "Staff", [Role.Staff] },
        { "a member with no role", [] },
    };

    [Theory]
    [MemberData(nameof(Outsiders))]
    public async Task A_shared_url_does_not_let_anyone_else_fetch_the_image(string who, Role[] roles)
    {
        var (owner, contact) = await OwnContact();
        var photo = await owner.AddContactPhotoAsync(contact.Id);

        var response = await factory.ClientFor(await factory.AddMemberAsync(who), roles).GetAsync(photo.Url);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.NotEqual("image/jpeg", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task An_anonymous_caller_gets_401()
    {
        var (owner, contact) = await OwnContact();
        var photo = await owner.AddContactPhotoAsync(contact.Id);

        var response = await factory.CreateClient().GetAsync(photo.Url);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task An_unknown_photo_answers_404()
    {
        var (client, contact) = await OwnContact();

        var response = await client.GetAsync($"/api/contacts/{contact.Id}/photos/{Guid.NewGuid()}/image");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task A_system_admin_fetching_another_leads_contact_image_is_audited()
    {
        var (owner, contact) = await OwnContact();
        var photo = await owner.AddContactPhotoAsync(contact.Id);
        var admin = await factory.AddMemberAsync("Priya Shah");

        var response = await factory.ClientFor(admin, Role.SystemAdmin).GetAsync(photo.Url);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var actions = await factory.WithDbAsync(db => db.AuditEntries.AsNoTracking()
            .Where(e => e.TargetId == contact.Id.ToString() && e.ActorId == admin.ProfileId).Select(e => e.Action).ToListAsync());
        Assert.Equal(["contact.photo-viewed"], actions);
    }

    private async Task<(HttpClient Client, Contact Contact)> OwnContact()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega");
        return (factory.ClientFor(grace, Role.CityLead), contact);
    }
}
