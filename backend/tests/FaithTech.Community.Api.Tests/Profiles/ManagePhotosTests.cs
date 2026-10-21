// Traces to: L2-007, L2-041
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Profiles;

public class ManagePhotosTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly DateTimeOffset Start = new(2026, 10, 1, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Featuring_a_photo_makes_it_the_only_featured_photo()
    {
        var (grace, photos) = await MemberWithPhotosAsync(3);

        var response = await factory.ClientFor(grace).PutAsync($"/api/profiles/{grace.ProfileId}/photos/{photos[1]}/featured", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var profile = await LoadAsync(grace.ProfileId);
        Assert.Equal(photos[1], Assert.Single(profile.Photos, p => p.IsFeatured).Id);
    }

    [Fact]
    public async Task Deleting_the_featured_photo_features_the_most_recently_uploaded_remaining_photo_and_removes_its_blob()
    {
        var (grace, photos) = await MemberWithPhotosAsync(3);
        var featuredKey = Key(grace, 0);

        var response = await factory.ClientFor(grace).DeleteAsync($"/api/profiles/{grace.ProfileId}/photos/{photos[0]}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var profile = await LoadAsync(grace.ProfileId);
        Assert.Equal(2, profile.Photos.Count);
        Assert.Equal(photos[2], Assert.Single(profile.Photos, p => p.IsFeatured).Id);
        Assert.False(factory.Photos.Blobs.ContainsKey(featuredKey));
    }

    [Fact]
    public async Task Deleting_another_photo_keeps_the_featured_photo()
    {
        var (grace, photos) = await MemberWithPhotosAsync(2);

        await factory.ClientFor(grace).DeleteAsync($"/api/profiles/{grace.ProfileId}/photos/{photos[1]}");

        var profile = await LoadAsync(grace.ProfileId);
        Assert.Equal(photos[0], Assert.Single(profile.Photos, p => p.IsFeatured).Id);
    }

    [Fact]
    public async Task A_photo_is_described_again()
    {
        var (grace, photos) = await MemberWithPhotosAsync(1);

        var response = await factory.ClientFor(grace).PutAsJsonAsync(
            $"/api/profiles/{grace.ProfileId}/photos/{photos[0]}", new { AltText = "  Grace speaking at Builders Night " });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("Grace speaking at Builders Night", Assert.Single((await LoadAsync(grace.ProfileId)).Photos).AltText);
    }

    [Fact]
    public async Task An_empty_description_is_rejected_with_describe_this_photo()
    {
        var (grace, photos) = await MemberWithPhotosAsync(1);

        var response = await factory.ClientFor(grace).PutAsJsonAsync(
            $"/api/profiles/{grace.ProfileId}/photos/{photos[0]}", new { AltText = " " });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Equal(["Describe this photo."], problem!.Errors["AltText"]);
        Assert.Equal("Photo 0", Assert.Single((await LoadAsync(grace.ProfileId)).Photos).AltText);
    }

    [Theory]
    [InlineData("PUT", "/featured")]
    [InlineData("DELETE", "")]
    [InlineData("PUT", "")]
    public async Task An_unknown_photo_is_404(string method, string suffix)
    {
        var (grace, _) = await MemberWithPhotosAsync(1);

        var response = await Send(factory.ClientFor(grace), method, $"/api/profiles/{grace.ProfileId}/photos/{Guid.NewGuid()}{suffix}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("PUT", "/featured")]
    [InlineData("DELETE", "")]
    [InlineData("PUT", "")]
    public async Task Anyone_but_the_owner_or_a_system_admin_gets_403(string method, string suffix)
    {
        var (samuel, photos) = await MemberWithPhotosAsync(2);
        var staff = await factory.AddMemberAsync("Daniel Reyes");

        var response = await Send(factory.ClientFor(staff, Role.Staff), method, $"/api/profiles/{samuel.ProfileId}/photos/{photos[1]}{suffix}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var profile = await LoadAsync(samuel.ProfileId);
        Assert.Equal(2, profile.Photos.Count);
        Assert.Equal(photos[0], Assert.Single(profile.Photos, p => p.IsFeatured).Id);
        Assert.Equal("Photo 1", profile.Photos.Single(p => p.Id == photos[1]).AltText);
    }

    [Theory]
    [InlineData("PUT", "/featured", "profile.photo.featured")]
    [InlineData("DELETE", "", "profile.photo.deleted")]
    [InlineData("PUT", "", "profile.photo.described")]
    public async Task System_admin_changes_to_another_profiles_photos_are_audited(string method, string suffix, string action)
    {
        var priya = await factory.AddMemberAsync("Priya Shah");
        var (samuel, photos) = await MemberWithPhotosAsync(2);

        var response = await Send(factory.ClientFor(priya, Role.SystemAdmin), method, $"/api/profiles/{samuel.ProfileId}/photos/{photos[1]}{suffix}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var entry = await factory.WithDbAsync(db => db.AuditEntries.SingleAsync(a => a.TargetId == samuel.ProfileId.ToString()));
        Assert.Equal(action, entry.Action);
        Assert.Equal(priya.ProfileId, entry.ActorId);
        Assert.Contains(photos[1].ToString(), entry.BeforeJson);
    }

    private static Task<HttpResponseMessage> Send(HttpClient client, string method, string path) =>
        client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path)
        {
            Content = method == "PUT" && !path.EndsWith("/featured") ? JsonContent.Create(new { AltText = "Changed" }) : null,
        });

    /// <summary>A member with photos uploaded a day apart, oldest first; the first is featured.</summary>
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
            factory.Photos.Blobs[Key(member, i)] = ([1, 2, 3], "image/jpeg");
        }

        return (member, [.. photos]);
    }

    private static string Key(ProfileClients.Member member, int index) => $"profiles/{member.ProfileId}/{index}.jpg";

    private Task<Profile> LoadAsync(Guid id) =>
        factory.WithDbAsync(db => db.Profiles.AsNoTracking().SingleAsync(p => p.Id == id));
}
