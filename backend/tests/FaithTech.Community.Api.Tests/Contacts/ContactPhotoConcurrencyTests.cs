// Traces to: L2-071
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Contacts.ContactClients;

namespace FaithTech.Community.Api.Tests.Contacts;

/// <summary>Overlapping photo writes on one contact keep the 10-photo limit and exactly one featured photo (L2-071 AC3).</summary>
public class ContactPhotoConcurrencyTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private const string ChangedMeanwhile = "Your photos changed while this was saving. Reload and try again.";
    private static readonly DateTimeOffset Start = new(2026, 10, 1, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Two_overlapping_uploads_to_nine_photos_leave_ten_and_refuse_the_other_without_a_blob()
    {
        var (client, contactId, _) = await ContactWithPhotosAsync(9);

        HoldOverlappingPhotoSaves();
        var responses = await Task.WhenAll(Upload(client, contactId, "Tenth"), Upload(client, contactId, "Eleventh"));

        Assert.Equal([HttpStatusCode.Created, HttpStatusCode.Conflict], responses.Select(r => r.StatusCode).Order());
        var refused = responses.Single(r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(ChangedMeanwhile, (await refused.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
        var photos = await PhotosOf(contactId);
        Assert.Equal(10, photos.Count);
        Assert.Single(photos, p => p.IsFeatured);
        Assert.Equal(photos.Select(p => p.BlobName).Order(), factory.Photos.Blobs.Keys.Where(k => k.StartsWith($"{FaithTechSeed.OrganisationId}/contacts/{contactId}/")).Order());
    }

    [Fact]
    public async Task Featuring_one_photo_while_the_featured_one_is_deleted_leaves_exactly_one_featured()
    {
        var (client, contactId, photos) = await ContactWithPhotosAsync(3);

        HoldOverlappingPhotoSaves();
        var responses = await Task.WhenAll(
            client.PutAsync($"/api/contacts/{contactId}/photos/{photos[1]}/featured", null),
            client.DeleteAsync($"/api/contacts/{contactId}/photos/{photos[0]}"));

        Assert.Contains(responses, r => r.IsSuccessStatusCode);
        Assert.Contains(responses, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Single(await PhotosOf(contactId), p => p.IsFeatured);
    }

    [Fact]
    public async Task Photo_writes_one_after_another_are_not_refused()
    {
        var (client, contactId, photos) = await ContactWithPhotosAsync(2);

        Assert.Equal(HttpStatusCode.Created, (await Upload(client, contactId, "Third")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsync($"/api/contacts/{contactId}/photos/{photos[1]}/featured", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/contacts/{contactId}/photos/{photos[0]}")).StatusCode);
    }

    private void HoldOverlappingPhotoSaves() =>
        factory.SaveGate.HoldUntil(2, db => db.ChangeTracker.Entries()
            .Any(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted
                && (e.Metadata.ClrType.Namespace == typeof(Domain.Contacts.Contact).Namespace || e.Metadata.ClrType == typeof(PhotoLease))));

    private async Task<(HttpClient Client, Guid ContactId, Guid[] Photos)> ContactWithPhotosAsync(int count)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega");
        var photos = await factory.WithDbAsync(async db =>
        {
            var stored = await db.Contacts.SingleAsync(c => c.Id == contact.Id);
            var ids = new List<Guid>();
            for (var i = 0; i < count; i++)
            {
                var photo = new Domain.Contacts.ContactPhoto($"{FaithTechSeed.OrganisationId}/contacts/{contact.Id}/{i}.jpg", $"Photo {i}", Start.AddDays(i));
                stored.AddPhoto(photo);
                ids.Add(photo.Id);
                factory.Photos.Blobs[photo.BlobName] = ([1, 2, 3], "image/jpeg");
            }

            await db.SaveChangesAsync();
            return ids.ToArray();
        });
        return (factory.ClientFor(grace, Role.CityLead), contact.Id, photos);
    }

    private static Task<HttpResponseMessage> Upload(HttpClient client, Guid contactId, string altText) =>
        client.UploadContactPhotoAsync(contactId, Profiles.TestImages.Jpeg(), "photo.jpg", altText);

    private Task<List<Domain.Contacts.ContactPhoto>> PhotosOf(Guid contactId) =>
        factory.WithDbAsync(async db => (await db.Contacts.AsNoTracking().SingleAsync(c => c.Id == contactId)).Photos.ToList());
}
