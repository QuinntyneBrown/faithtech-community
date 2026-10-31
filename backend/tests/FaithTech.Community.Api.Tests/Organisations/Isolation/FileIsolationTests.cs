using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Contacts;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Api.Tests.Resources;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Organisations.Isolation;

// Traces to: L2-130 AC3, AC5. Every uploaded file is stored under its organisation's id, and is reachable only through
// a record of that organisation, so another organisation's file is 404.
public class FileIsolationTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private sealed record Created(Guid Id);

    [Fact]
    public async Task A_profile_photo_is_stored_under_its_organisation()
    {
        var northside = await factory.AddOrganisationAsync();
        var ana = await factory.AddMemberAsync(northside, "Ana Lima");
        var file = new ByteArrayContent(TestImages.Jpeg());
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");

        var response = await factory.ClientOn(northside, ana).PostAsync($"/api/profiles/{ana.ProfileId}/photos",
            new MultipartFormDataContent { { file, "file", "photo.jpg" }, { new StringContent("Ana at the launch"), "altText" } });

        response.EnsureSuccessStatusCode();
        Assert.Contains(factory.Photos.Blobs.Keys, key => key.StartsWith($"{northside.Id}/profiles/{ana.ProfileId}/"));
    }

    [Fact]
    public async Task A_contact_photo_is_stored_under_its_organisation_and_not_found_elsewhere()
    {
        var northside = await factory.AddOrganisationAsync();
        var lead = factory.ClientOn(northside, await factory.AddMemberAsync(northside, "Ana Lima", Role.CityLead));
        var contact = await (await lead.PostAsync("/api/contacts", ContactClients.NewContact("Tomás Ortega"))).CreatedIdAsync();

        var photo = await lead.AddContactPhotoAsync(contact);

        Assert.Contains(factory.Photos.Blobs.Keys, key => key.StartsWith($"{northside.Id}/contacts/{contact}/"));
        var admin = await factory.FaithTechAdminAsync();
        await admin.AssertNotFoundAsync($"/api/contacts/{contact}/photos/{photo.Id}/image");
    }

    [Fact]
    public async Task A_resource_file_is_stored_under_its_organisation_and_not_found_elsewhere()
    {
        var northside = await factory.AddOrganisationAsync();
        var lead = factory.ClientOn(northside, await factory.AddMemberAsync(northside, "Ana Lima", Role.CityLead));

        var response = await lead.UploadAsync(ResourceClients.Deck(), new Dictionary<string, string> { ["visibility"] = "Global" });

        response.EnsureSuccessStatusCode();
        var id = (await response.Content.ReadFromJsonAsync<Created[]>())!.Single().Id;
        Assert.Contains(factory.Files.Blobs.Keys, key => key.StartsWith($"{northside.Id}/resources/{id}/"));
        var admin = await factory.FaithTechAdminAsync();
        await admin.AssertNotFoundAsync($"/api/resources/{id}/file");
        await admin.AssertNotFoundAsync($"/api/resources/{id}/thumbnail");
    }

    [Fact]
    public async Task A_note_image_is_stored_under_its_organisation_and_not_found_elsewhere()
    {
        var northside = await factory.AddOrganisationAsync();
        var owner = factory.ClientOn(northside, await factory.AddMemberAsync(northside, "Ana Lima"));
        var page = await (await owner.PostAsync("/api/notes", new { Title = "Launch plan" })).CreatedIdAsync();
        var file = new ByteArrayContent(TestImages.Png());
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");

        var response = await owner.PostAsync($"/api/notes/{page}/images", new MultipartFormDataContent { { file, "file", "map.png" } });

        response.EnsureSuccessStatusCode();
        var imageId = (await response.Content.ReadFromJsonAsync<Uploaded>())!.ImageId;
        Assert.Contains(factory.Files.Blobs.Keys, key => key.StartsWith($"{northside.Id}/notes/{page}/"));
        var admin = await factory.FaithTechAdminAsync();
        await admin.AssertNotFoundAsync($"/api/notes/{page}/images/{imageId}");
    }

    private sealed record Uploaded(Guid ImageId);
}
