// Traces to: L2-007, L2-047
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using FaithTech.Community.Api.Tests.Organisations;
using FaithTech.Community.Application.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Api.Tests.Profiles;

/// <summary>Photo actions still succeed while blob storage is down, and the blob work is retried (L2-047 AC3).</summary>
public class PhotoStorageOutageTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task An_upload_while_storage_is_down_is_saved_as_storing_and_stored_when_storage_recovers()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace);
        factory.Photos.Down = true;

        var response = await Upload(client, grace, "Grace at Builders Night");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var photo = (await response.Content.ReadFromJsonAsync<Photo>())!;
        Assert.False(photo.IsStored);
        Assert.Null(photo.Url);
        Assert.True(photo.IsFeatured);
        var storing = await ProfileAsync(client);
        Assert.Equal([photo.Id], storing.Photos.Select(p => p.Id));
        Assert.False(storing.Photos[0].IsStored);

        await RetryAsync();
        Assert.Empty(factory.Photos.Blobs);

        factory.Photos.Down = false;
        factory.Time.Advance(TimeSpan.FromHours(1));
        await RetryAsync();
        await RetryAsync();

        var stored = await ProfileAsync(client);
        var single = Assert.Single(stored.Photos);
        Assert.True(single.IsStored);
        Assert.True(single.IsFeatured);
        Assert.Equal(single.Id, stored.FeaturedPhoto!.Id);
        Assert.NotNull(single.Url);
        Assert.Single(factory.Photos.Blobs, b => b.Key.StartsWith($"{FaithTechSeed.OrganisationId}/profiles/{grace.ProfileId}/"));
    }

    [Fact]
    public async Task A_storing_photo_counts_towards_the_ten_photo_limit()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace);
        factory.Photos.Down = true;
        for (var i = 0; i < 10; i++)
        {
            (await Upload(client, grace, $"Photo {i}")).EnsureSuccessStatusCode();
        }

        var eleventh = await Upload(client, grace, "One too many");

        Assert.Equal(HttpStatusCode.BadRequest, eleventh.StatusCode);
        factory.Photos.Down = false;
    }

    [Fact]
    public async Task An_invalid_upload_still_fails_inline_while_storage_is_down()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        factory.Photos.Down = true;

        var response = await Upload(factory.ClientFor(grace), grace, "");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["Describe this photo."], (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors["AltText"]);
        Assert.Empty((await ProfileAsync(factory.ClientFor(grace))).Photos);
        factory.Photos.Down = false;
    }

    [Fact]
    public async Task A_delete_while_storage_is_down_removes_the_photo_and_deletes_the_blob_later()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace);
        var photo = (await (await Upload(client, grace, "Grace at Builders Night")).Content.ReadFromJsonAsync<Photo>())!;
        var key = photo.Url![Fakes.FakePhotoStorage.BaseUrl.Length..];
        factory.Photos.Down = true;

        var response = await client.DeleteAsync($"/api/profiles/{grace.ProfileId}/photos/{photo.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Empty((await ProfileAsync(client)).Photos);
        Assert.True(factory.Photos.Blobs.ContainsKey(key));

        factory.Photos.Down = false;
        factory.Time.Advance(TimeSpan.FromHours(1));
        await RetryAsync();
        Assert.False(factory.Photos.Blobs.ContainsKey(key));
    }

    [Fact]
    public async Task Deleting_a_photo_that_is_still_storing_never_writes_its_blob()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace);
        factory.Photos.Down = true;
        var photo = (await (await Upload(client, grace, "Grace at Builders Night")).Content.ReadFromJsonAsync<Photo>())!;

        var response = await client.DeleteAsync($"/api/profiles/{grace.ProfileId}/photos/{photo.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        factory.Photos.Down = false;
        factory.Time.Advance(TimeSpan.FromHours(1));
        await RetryAsync();
        Assert.DoesNotContain(factory.Photos.Blobs, b => b.Key.StartsWith($"{FaithTechSeed.OrganisationId}/profiles/{grace.ProfileId}/"));
    }

    private async Task RetryAsync()
    {
        await using var scope = factory.Services.CreateFaithTechScope();
        await scope.ServiceProvider.GetRequiredService<PhotoStorageRetryHandler>().RunAsync();
    }

    private static async Task<Profile> ProfileAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<Profile>("/api/profiles/me"))!;

    private static Task<HttpResponseMessage> Upload(HttpClient client, ProfileClients.Member owner, string altText)
    {
        var file = new ByteArrayContent(TestImages.Jpeg());
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        var form = new MultipartFormDataContent { { file, "file", "photo.jpg" }, { new StringContent(altText), "altText" } };
        return client.PostAsync($"/api/profiles/{owner.ProfileId}/photos", form);
    }

    private sealed record Photo(Guid Id, string? Url, string AltText, bool IsFeatured, bool IsStored);

    private sealed record Profile(Photo? FeaturedPhoto, Photo[] Photos);
}
