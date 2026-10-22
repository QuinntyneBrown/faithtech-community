// Traces to: L2-056, L2-058
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Contacts.ContactClients;

namespace FaithTech.Community.Api.Tests.Contacts;

public class ManageContactPhotosTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task The_owner_features_a_photo_and_it_becomes_the_only_featured_one()
    {
        var (client, contact) = await OwnContact();
        await client.AddContactPhotoAsync(contact.Id, "First");
        var second = await client.AddContactPhotoAsync(contact.Id, "Second");

        var response = await client.PutAsync($"/api/contacts/{contact.Id}/photos/{second.Id}/featured", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var reloaded = await Reload(client, contact.Id);
        Assert.Equal([second.Id], reloaded.Photos.Where(p => p.IsFeatured).Select(p => p.Id));
        Assert.Equal("Second", reloaded.PhotoAltText);
    }

    [Fact]
    public async Task The_owner_changes_a_description_and_an_empty_one_is_refused()
    {
        var (client, contact) = await OwnContact();
        var photo = await client.AddContactPhotoAsync(contact.Id, "Before");

        var saved = await client.PutAsJsonAsync($"/api/contacts/{contact.Id}/photos/{photo.Id}", new { AltText = " Tomás pouring coffee " });
        var empty = await client.PutAsJsonAsync($"/api/contacts/{contact.Id}/photos/{photo.Id}", new { AltText = " " });

        Assert.Equal(HttpStatusCode.NoContent, saved.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
        var problem = (await empty.Content.ReadFromJsonAsync<ValidationProblemDetails>())!;
        Assert.Equal(["Describe this photo."], problem.Errors["AltText"]);
        Assert.Equal("Tomás pouring coffee", (await Reload(client, contact.Id)).Photos.Single().AltText);
    }

    [Fact]
    public async Task Deleting_the_featured_photo_removes_its_blob_and_features_the_newest_remaining_photo()
    {
        var (client, contact) = await OwnContact();
        var first = await client.AddContactPhotoAsync(contact.Id, "First");
        factory.Time.Advance(TimeSpan.FromMinutes(1));
        await client.AddContactPhotoAsync(contact.Id, "Second");
        factory.Time.Advance(TimeSpan.FromMinutes(1));
        var newest = await client.AddContactPhotoAsync(contact.Id, "Newest");
        var key = await BlobOf(contact.Id, first.Id);

        var response = await client.DeleteAsync($"/api/contacts/{contact.Id}/photos/{first.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var reloaded = await Reload(client, contact.Id);
        Assert.DoesNotContain(reloaded.Photos, p => p.Id == first.Id);
        Assert.Equal([newest.Id], reloaded.Photos.Where(p => p.IsFeatured).Select(p => p.Id));
        Assert.False(factory.Photos.Blobs.ContainsKey(key));
    }

    [Fact]
    public async Task An_unknown_photo_answers_404()
    {
        var (client, contact) = await OwnContact();

        var feature = await client.PutAsync($"/api/contacts/{contact.Id}/photos/{Guid.NewGuid()}/featured", null);
        var delete = await client.DeleteAsync($"/api/contacts/{contact.Id}/photos/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, feature.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);
    }

    public static TheoryData<string, Role[]> Outsiders() => new()
    {
        { "another lead", [Role.CityLead] },
        { "Staff", [Role.Staff] },
        { "a member with no role", [] },
    };

    [Theory]
    [MemberData(nameof(Outsiders))]
    public async Task Anyone_but_the_owner_or_a_system_admin_gets_404_and_changes_nothing(string who, Role[] roles)
    {
        var (owner, contact) = await OwnContact();
        await owner.AddContactPhotoAsync(contact.Id, "First");
        var second = await owner.AddContactPhotoAsync(contact.Id, "Second");
        var client = factory.ClientFor(await factory.AddMemberAsync(who), roles);

        var responses = new[]
        {
            await client.PutAsync($"/api/contacts/{contact.Id}/photos/{second.Id}/featured", null),
            await client.PutAsJsonAsync($"/api/contacts/{contact.Id}/photos/{second.Id}", new { AltText = "Changed" }),
            await client.DeleteAsync($"/api/contacts/{contact.Id}/photos/{second.Id}"),
        };

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.NotFound, r.StatusCode));
        var reloaded = await Reload(owner, contact.Id);
        Assert.Equal(2, reloaded.Photos.Length);
        Assert.Equal("Second", reloaded.Photos.Single(p => p.Id == second.Id).AltText);
        Assert.False(reloaded.Photos.Single(p => p.Id == second.Id).IsFeatured);
    }

    [Fact]
    public async Task A_system_admins_changes_to_another_leads_contact_photos_are_audited()
    {
        var (owner, contact) = await OwnContact();
        await owner.AddContactPhotoAsync(contact.Id, "First");
        var second = await owner.AddContactPhotoAsync(contact.Id, "Second");
        var admin = await factory.AddMemberAsync("Priya Shah");
        var client = factory.ClientFor(admin, Role.SystemAdmin);

        await client.PutAsync($"/api/contacts/{contact.Id}/photos/{second.Id}/featured", null);
        await client.PutAsJsonAsync($"/api/contacts/{contact.Id}/photos/{second.Id}", new { AltText = "Changed" });
        await client.DeleteAsync($"/api/contacts/{contact.Id}/photos/{second.Id}");

        var actions = await factory.WithDbAsync(db => db.AuditEntries.AsNoTracking()
            .Where(e => e.TargetId == contact.Id.ToString() && e.ActorId == admin.ProfileId).Select(e => e.Action).ToListAsync());
        Assert.Equal(["contact.photo-deleted", "contact.photo-described", "contact.photo-featured"], actions.Order());
    }

    [Fact]
    public async Task Archiving_and_restoring_keep_the_photos_and_a_permanent_delete_removes_them_and_their_blobs()
    {
        var (client, contact) = await OwnContact();
        var photo = await client.AddContactPhotoAsync(contact.Id, "Kept");
        var key = await BlobOf(contact.Id, photo.Id);

        await client.PostAsync($"/api/contacts/{contact.Id}/archive", null);
        await client.PostAsync($"/api/contacts/{contact.Id}/restore", null);
        var kept = await Reload(client, contact.Id);
        await client.PostAsync($"/api/contacts/{contact.Id}/archive", null);
        var deleted = await client.DeleteAsync($"/api/contacts/{contact.Id}");

        Assert.Equal([photo.Id], kept.Photos.Select(p => p.Id));
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.False(factory.Photos.Blobs.ContainsKey(key));
        Assert.Equal(0, await factory.WithDbAsync(db => db.Contacts.CountAsync(c => c.Id == contact.Id)));
    }

    private async Task<(HttpClient Client, Contact Contact)> OwnContact()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega");
        return (factory.ClientFor(grace, Role.CityLead), contact);
    }

    private static async Task<Contact> Reload(HttpClient client, Guid contactId) =>
        (await client.GetFromJsonAsync<Contact>($"/api/contacts/{contactId}"))!;

    private Task<string> BlobOf(Guid contactId, Guid photoId) =>
        factory.WithDbAsync(async db => (await db.Contacts.AsNoTracking().SingleAsync(c => c.Id == contactId)).Photos.Single(p => p.Id == photoId).BlobName);
}
