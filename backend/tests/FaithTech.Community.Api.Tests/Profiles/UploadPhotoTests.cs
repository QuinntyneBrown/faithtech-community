// Traces to: L2-007, L2-041
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace FaithTech.Community.Api.Tests.Profiles;

public class UploadPhotoTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private const int FiveMegabytes = 5 * 1024 * 1024;

    [Fact]
    public async Task Jpeg_is_resized_stripped_of_metadata_stored_and_shown_as_the_featured_photo()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace);

        var response = await Upload(client, grace, TestImages.JpegWithExif(3200, 1600), "builders-night.jpg",
            "Grace speaking at Builders Night");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var photo = (await response.Content.ReadFromJsonAsync<ViewProfileTests.PhotoResponse>())!;
        Assert.True(photo.IsFeatured);
        Assert.Equal("Grace speaking at Builders Night", photo.AltText);
        var key = photo.Url[Fakes.FakePhotoStorage.BaseUrl.Length..];
        Assert.StartsWith($"{FaithTechSeed.OrganisationId}/profiles/{grace.ProfileId}/", key);
        Assert.EndsWith(".jpg", key);
        var (content, contentType) = factory.Photos.Blobs[key];
        Assert.Equal("image/jpeg", contentType);
        Assert.Equal((1600, 800), TestImages.Size(content));
        var text = Encoding.ASCII.GetString(content);
        Assert.DoesNotContain("Exif", text);
        Assert.DoesNotContain(TestImages.CameraMake, text);

        var profile = await client.GetFromJsonAsync<ViewProfileTests.ProfileResponse>("/api/profiles/me");
        Assert.Equal(photo.Id, profile!.FeaturedPhoto!.Id);
    }

    [Fact]
    public async Task A_photo_taken_sideways_is_turned_upright()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await Upload(factory.ClientFor(grace), grace, TestImages.JpegWithExif(64, 48, orientation: 6), "sideways.jpg", "A sideways photo");

        var photo = (await response.Content.ReadFromJsonAsync<ViewProfileTests.PhotoResponse>())!;
        var stored = factory.Photos.Blobs[photo.Url[Fakes.FakePhotoStorage.BaseUrl.Length..]].Content;
        Assert.Equal((48, 64), TestImages.Size(stored));
    }

    public static TheoryData<byte[], string, string> AcceptedFormats() => new()
    {
        { TestImages.Png(), "team.png", "image/png" },
        { TestImages.Webp(), "city.webp", "image/webp" },
        { TestImages.Jpeg(), "hackathon.JPEG", "image/jpeg" },
    };

    [Theory]
    [MemberData(nameof(AcceptedFormats))]
    public async Task Png_webp_and_jpeg_are_accepted_and_a_later_photo_is_not_featured(byte[] image, string fileName, string contentType)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace);
        await Upload(client, grace, TestImages.Jpeg(), "first.jpg", "The first photo");

        var response = await Upload(client, grace, image, fileName, "A second photo");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var photo = (await response.Content.ReadFromJsonAsync<ViewProfileTests.PhotoResponse>())!;
        Assert.False(photo.IsFeatured);
        Assert.Equal(contentType, factory.Photos.Blobs[photo.Url[Fakes.FakePhotoStorage.BaseUrl.Length..]].ContentType);
    }

    [Fact]
    public async Task A_file_over_5_mb_is_rejected_on_the_file()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await Upload(factory.ClientFor(grace), grace, new byte[FiveMegabytes + 1], "team.jpg", "The team");

        await AssertRejected(response, "File", "team.jpg is 5.0 MB. Photos can be up to 5 MB — try a smaller one.", grace);
    }

    [Fact]
    public async Task A_file_of_another_type_is_rejected()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await Upload(factory.ClientFor(grace), grace, "GIF89a"u8.ToArray(), "party.gif", "A party");

        await AssertRejected(response, "File", "party.gif isn’t a photo we can use. Photos must be JPEG, PNG or WebP.", grace);
    }

    [Theory]
    [InlineData("png-as-jpeg.jpg", "JPEG")]
    [InlineData("notes.png", "PNG")]
    public async Task Content_that_does_not_match_the_extension_is_rejected(string fileName, string format)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var content = fileName.EndsWith(".jpg") ? TestImages.Png() : "just some text"u8.ToArray();

        var response = await Upload(factory.ClientFor(grace), grace, content, fileName, "A photo");

        await AssertRejected(response, "File", $"{fileName} isn’t really a {format} image. Choose a JPEG, PNG or WebP photo.", grace);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Empty_alt_text_is_rejected_with_describe_this_photo(string altText)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await Upload(factory.ClientFor(grace), grace, TestImages.Jpeg(), "a.jpg", altText);

        await AssertRejected(response, "AltText", "Describe this photo.", grace);
    }

    [Fact]
    public async Task The_eleventh_photo_is_rejected()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo", p =>
        {
            for (var i = 0; i < Profile.MaxPhotos; i++)
            {
                p.AddPhoto(new ProfilePhoto($"{FaithTechSeed.OrganisationId}/profiles/{p.Id}/{i}.jpg", $"Photo {i}", DateTimeOffset.UtcNow.AddMinutes(i)));
            }
        });

        var response = await Upload(factory.ClientFor(grace), grace, TestImages.Jpeg(), "eleven.jpg", "One too many");

        var problem = await AssertValidationProblem(response);
        Assert.Equal(["That’s 10 photos, the most a profile can have. Remove one to add another."], problem.Errors["File"]);
        Assert.Equal(Profile.MaxPhotos, (await LoadAsync(grace.ProfileId)).Photos.Count);
    }

    [Theory]
    [InlineData]
    [InlineData(Role.Staff)]
    public async Task Anyone_but_the_owner_or_a_system_admin_gets_403(params Role[] roles)
    {
        var samuel = await factory.AddMemberAsync("Samuel Mensah");
        var other = await factory.AddMemberAsync("Daniel Reyes");

        var response = await Upload(factory.ClientFor(other, roles), samuel, TestImages.Jpeg(), "a.jpg", "A photo");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty((await LoadAsync(samuel.ProfileId)).Photos);
    }

    [Fact]
    public async Task System_admin_upload_to_another_profile_is_audited()
    {
        var priya = await factory.AddMemberAsync("Priya Shah");
        var samuel = await factory.AddMemberAsync("Samuel Mensah");

        var response = await Upload(factory.ClientFor(priya, Role.SystemAdmin), samuel, TestImages.Jpeg(), "a.jpg", "Samuel at the hackathon");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var entry = await factory.WithDbAsync(db => db.AuditEntries.SingleAsync(a => a.TargetId == samuel.ProfileId.ToString()));
        Assert.Equal("profile.photo.uploaded", entry.Action);
        Assert.Equal(priya.ProfileId, entry.ActorId);
        Assert.Contains("Samuel at the hackathon", entry.AfterJson);
    }

    private static Task<HttpResponseMessage> Upload(
        HttpClient client, ProfileClients.Member owner, byte[] content, string fileName, string altText)
    {
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        var form = new MultipartFormDataContent { { file, "file", fileName }, { new StringContent(altText), "altText" } };
        return client.PostAsync($"/api/profiles/{owner.ProfileId}/photos", form);
    }

    private async Task AssertRejected(HttpResponseMessage response, string field, string message, ProfileClients.Member owner)
    {
        var problem = await AssertValidationProblem(response);
        Assert.Equal([message], problem.Errors[field]);
        Assert.Empty((await LoadAsync(owner.ProfileId)).Photos);
        Assert.DoesNotContain(factory.Photos.Blobs.Keys, k => k.StartsWith($"{FaithTechSeed.OrganisationId}/profiles/{owner.ProfileId}/"));
    }

    private Task<Profile> LoadAsync(Guid id) =>
        factory.WithDbAsync(db => db.Profiles.AsNoTracking().SingleAsync(p => p.Id == id));

    private static async Task<ValidationProblemDetails> AssertValidationProblem(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!;
    }
}
