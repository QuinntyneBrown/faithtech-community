// Traces to: L2-007
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Profiles;

/// <summary>Overlapping photo writes keep the 10-photo limit and exactly one featured photo (L2-007).</summary>
public class PhotoConcurrencyTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private const string ChangedMeanwhile = "Your photos changed while this was saving. Reload and try again.";
    private static readonly DateTimeOffset Start = new(2026, 10, 1, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Two_overlapping_uploads_to_nine_photos_leave_ten_and_refuse_the_other()
    {
        var (grace, _) = await MemberWithPhotosAsync(9);
        var client = factory.ClientFor(grace);

        HoldOverlappingPhotoSaves();
        var responses = await Task.WhenAll(Upload(client, grace, "Tenth"), Upload(client, grace, "Eleventh"));

        Assert.Equal([HttpStatusCode.Created, HttpStatusCode.Conflict], responses.Select(r => r.StatusCode).Order());
        await AssertRefusedAsChangedMeanwhile(responses);
        var profile = await LoadAsync(grace.ProfileId);
        Assert.Equal(10, profile.Photos.Count);
        Assert.Single(profile.Photos, p => p.IsFeatured);
        // The refused upload stored no blob: every blob belongs to a photo.
        Assert.Equal(
            profile.Photos.Select(p => p.BlobName).Order(),
            factory.Photos.Blobs.Keys.Where(k => k.StartsWith($"profiles/{grace.ProfileId}/")).Order());
    }

    [Fact]
    public async Task Two_overlapping_first_uploads_leave_exactly_one_featured_photo()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace);

        HoldOverlappingPhotoSaves();
        var responses = await Task.WhenAll(Upload(client, grace, "First"), Upload(client, grace, "Also first"));

        Assert.Equal([HttpStatusCode.Created, HttpStatusCode.Conflict], responses.Select(r => r.StatusCode).Order());
        var profile = await LoadAsync(grace.ProfileId);
        Assert.True(Assert.Single(profile.Photos).IsFeatured);
    }

    [Fact]
    public async Task Featuring_one_photo_while_the_featured_one_is_deleted_leaves_exactly_one_featured()
    {
        var (grace, photos) = await MemberWithPhotosAsync(3);
        var client = factory.ClientFor(grace);

        HoldOverlappingPhotoSaves();
        var responses = await Task.WhenAll(
            client.PutAsync($"/api/profiles/{grace.ProfileId}/photos/{photos[1]}/featured", null),
            client.DeleteAsync($"/api/profiles/{grace.ProfileId}/photos/{photos[0]}"));

        Assert.Contains(responses, r => r.IsSuccessStatusCode);
        var profile = await LoadAsync(grace.ProfileId);
        Assert.Single(profile.Photos, p => p.IsFeatured);
        if (profile.Photos.Count == 2 && responses[0].StatusCode == HttpStatusCode.Conflict)
        {
            // Only the delete went through: the newest remaining photo took over.
            Assert.Equal(photos[2], profile.Photos.Single(p => p.IsFeatured).Id);
        }
    }

    [Fact]
    public async Task Photo_writes_one_after_another_are_not_refused()
    {
        var (grace, photos) = await MemberWithPhotosAsync(2);
        var client = factory.ClientFor(grace);

        Assert.Equal(HttpStatusCode.Created, (await Upload(client, grace, "Third")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsync($"/api/profiles/{grace.ProfileId}/photos/{photos[1]}/featured", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/profiles/{grace.ProfileId}/photos/{photos[0]}")).StatusCode);
    }

    private void HoldOverlappingPhotoSaves() =>
        factory.SaveGate.HoldUntil(2, db => db.ChangeTracker.Entries()
            .Any(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted
                && e.Metadata.ClrType.Namespace == typeof(Profile).Namespace));

    private static async Task AssertRefusedAsChangedMeanwhile(HttpResponseMessage[] responses)
    {
        var refused = responses.Single(r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(ChangedMeanwhile, (await refused.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
    }

    private async Task<(ProfileClients.Member Member, Guid[] Photos)> MemberWithPhotosAsync(int count)
    {
        var photos = new List<Guid>();
        var member = await factory.AddMemberAsync("Grace Okonkwo", p =>
        {
            for (var i = 0; i < count; i++)
            {
                var photo = new ProfilePhoto($"profiles/{p.Id}/{i}.jpg", $"Photo {i}", Start.AddDays(i));
                p.AddPhoto(photo);
                photos.Add(photo.Id);
            }
        });
        for (var i = 0; i < count; i++)
        {
            factory.Photos.Blobs[$"profiles/{member.ProfileId}/{i}.jpg"] = ([1, 2, 3], "image/jpeg");
        }

        return (member, [.. photos]);
    }

    private static Task<HttpResponseMessage> Upload(HttpClient client, ProfileClients.Member owner, string altText)
    {
        var file = new ByteArrayContent(TestImages.Jpeg());
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        var form = new MultipartFormDataContent { { file, "file", "photo.jpg" }, { new StringContent(altText), "altText" } };
        return client.PostAsync($"/api/profiles/{owner.ProfileId}/photos", form);
    }

    private Task<Profile> LoadAsync(Guid id) =>
        factory.WithDbAsync(db => db.Profiles.AsNoTracking().SingleAsync(p => p.Id == id));
}
