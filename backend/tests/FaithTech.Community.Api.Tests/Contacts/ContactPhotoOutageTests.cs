// Traces to: L2-071, L2-047
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static FaithTech.Community.Api.Tests.Contacts.ContactClients;

namespace FaithTech.Community.Api.Tests.Contacts;

/// <summary>Contact photo actions still succeed while blob storage is down, and the blob work is retried (L2-071).</summary>
public class ContactPhotoOutageTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task A_photo_added_while_storage_is_down_is_storing_counts_and_is_stored_when_storage_recovers()
    {
        var (client, contact) = await OwnContact();
        factory.Photos.Down = true;

        var response = await client.UploadContactPhotoAsync(contact.Id, Profiles.TestImages.Jpeg(), "a.jpg", "Tomás at the coffee morning");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var photo = (await response.Content.ReadFromJsonAsync<ContactPhoto>())!;
        Assert.False(photo.IsStored);
        Assert.Null(photo.Url);
        Assert.True(photo.IsFeatured);
        var storing = await Reload(client, contact.Id);
        Assert.Null(storing.PhotoUrl);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/contacts/{contact.Id}/photos/{photo.Id}/image")).StatusCode);

        factory.Photos.Down = false;
        factory.Time.Advance(TimeSpan.FromHours(1));
        await RetryAsync();

        var stored = Assert.Single((await Reload(client, contact.Id)).Photos);
        Assert.True(stored.IsStored);
        Assert.Equal($"/api/contacts/{contact.Id}/photos/{photo.Id}/image", stored.Url);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(stored.Url)).StatusCode);
    }

    [Fact]
    public async Task Deleting_a_photo_while_storage_is_down_removes_it_now_and_its_blob_later()
    {
        var (client, contact) = await OwnContact();
        var photo = await client.AddContactPhotoAsync(contact.Id);
        var key = factory.Photos.Blobs.Keys.Single(k => k.StartsWith($"contacts/{contact.Id}/"));
        factory.Photos.Down = true;

        var response = await client.DeleteAsync($"/api/contacts/{contact.Id}/photos/{photo.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Empty((await Reload(client, contact.Id)).Photos);
        Assert.True(factory.Photos.Blobs.ContainsKey(key));

        factory.Photos.Down = false;
        await RetryAsync();
        Assert.False(factory.Photos.Blobs.ContainsKey(key));
    }

    [Fact]
    public async Task Permanently_deleting_a_contact_while_storage_is_down_deletes_its_blobs_later_and_drops_queued_writes()
    {
        var (client, contact) = await OwnContact();
        await client.AddContactPhotoAsync(contact.Id, "Stored");
        var key = factory.Photos.Blobs.Keys.Single(k => k.StartsWith($"contacts/{contact.Id}/"));
        factory.Photos.Down = true;
        await client.AddContactPhotoAsync(contact.Id, "Storing");
        await client.PostAsync($"/api/contacts/{contact.Id}/archive", null);

        var response = await client.DeleteAsync($"/api/contacts/{contact.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        factory.Photos.Down = false;
        await RetryAsync();
        Assert.DoesNotContain(factory.Photos.Blobs.Keys, k => k.StartsWith($"contacts/{contact.Id}/"));
        Assert.False(factory.Photos.Blobs.ContainsKey(key));
        Assert.Equal(0, await factory.WithDbAsync(db => db.PhotoBlobTasks.CountAsync(t => t.BlobName.StartsWith($"contacts/{contact.Id}/"))));
    }

    [Fact]
    public async Task A_storing_photo_counts_towards_the_ten_photo_limit()
    {
        var (client, contact) = await OwnContact();
        factory.Photos.Down = true;
        for (var i = 0; i < 10; i++)
        {
            await client.AddContactPhotoAsync(contact.Id, $"Photo {i}");
        }

        var eleventh = await client.UploadContactPhotoAsync(contact.Id, Profiles.TestImages.Jpeg(), "a.jpg", "One too many");

        factory.Photos.Down = false;
        Assert.Equal(HttpStatusCode.BadRequest, eleventh.StatusCode);
    }

    private async Task RetryAsync()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<PhotoStorageRetryHandler>().RunAsync();
    }

    private async Task<(HttpClient Client, Contact Contact)> OwnContact()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega");
        return (factory.ClientFor(grace, Role.CityLead), contact);
    }

    private static async Task<Contact> Reload(HttpClient client, Guid contactId) =>
        (await client.GetFromJsonAsync<Contact>($"/api/contacts/{contactId}"))!;
}
