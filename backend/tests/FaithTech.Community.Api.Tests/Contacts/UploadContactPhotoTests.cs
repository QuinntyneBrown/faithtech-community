// Traces to: L2-067, L2-068, L2-069, L2-070
using System.Net;
using System.Net.Http.Json;
using System.Text;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Contacts.ContactClients;

namespace FaithTech.Community.Api.Tests.Contacts;

public class UploadContactPhotoTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task The_owner_adds_a_photo_that_is_resized_stripped_stored_privately_and_featured()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega");
        var client = factory.ClientFor(grace, Role.CityLead);

        var response = await client.UploadContactPhotoAsync(contact.Id, TestImages.JpegWithExif(3200, 1600), "coffee.jpg", "  Tomás at the coffee morning ");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var photo = (await response.Content.ReadFromJsonAsync<ContactPhoto>())!;
        Assert.True(photo.IsFeatured);
        Assert.True(photo.IsStored);
        Assert.Equal("Tomás at the coffee morning", photo.AltText);
        // The URL is the authenticated API, never a storage link (L2-070 AC3).
        Assert.Equal($"/api/contacts/{contact.Id}/photos/{photo.Id}/image", photo.Url);
        var key = Assert.Single(factory.Photos.Blobs.Keys, k => k.StartsWith($"{FaithTechSeed.OrganisationId}/contacts/{contact.Id}/"));
        Assert.EndsWith(".jpg", key);
        var (content, contentType) = factory.Photos.Blobs[key];
        Assert.Equal("image/jpeg", contentType);
        Assert.Equal((1600, 800), TestImages.Size(content));
        Assert.DoesNotContain(TestImages.CameraMake, Encoding.ASCII.GetString(content));

        var reloaded = (await client.GetFromJsonAsync<Contact>($"/api/contacts/{contact.Id}"))!;
        Assert.Equal([photo.Id], reloaded.Photos.Select(p => p.Id));
        Assert.Equal(photo.Url, reloaded.PhotoUrl);
        Assert.Equal("Tomás at the coffee morning", reloaded.PhotoAltText);
    }

    [Fact]
    public async Task A_later_photo_is_not_featured_and_photos_are_listed_newest_first()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega");
        var client = factory.ClientFor(grace, Role.CityLead);
        var first = await client.AddContactPhotoAsync(contact.Id, "First");
        factory.Time.Advance(TimeSpan.FromMinutes(1));

        var second = await client.AddContactPhotoAsync(contact.Id, "Second");

        Assert.False(second.IsFeatured);
        var reloaded = (await client.GetFromJsonAsync<Contact>($"/api/contacts/{contact.Id}"))!;
        Assert.Equal([second.Id, first.Id], reloaded.Photos.Select(p => p.Id));
        Assert.Equal("First", reloaded.PhotoAltText);
    }

    public static TheoryData<string, Role[]> Outsiders() => new()
    {
        { "another lead", [Role.CityLead] },
        { "Staff", [Role.Staff] },
        { "a member with no role", [] },
    };

    [Theory]
    [MemberData(nameof(Outsiders))]
    public async Task Anyone_but_the_owner_or_a_system_admin_gets_404_and_nothing_is_stored(string who, Role[] roles)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega");
        var outsider = await factory.AddMemberAsync(who);

        var response = await factory.ClientFor(outsider, roles).UploadContactPhotoAsync(contact.Id, TestImages.Jpeg(), "a.jpg", "A photo");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(await PhotosOf(contact.Id));
        Assert.DoesNotContain(factory.Photos.Blobs.Keys, k => k.StartsWith($"{FaithTechSeed.OrganisationId}/contacts/{contact.Id}/"));
    }

    [Fact]
    public async Task An_unknown_contact_answers_404()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace, Role.CityLead).UploadContactPhotoAsync(Guid.NewGuid(), TestImages.Jpeg(), "a.jpg", "A photo");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task A_system_admin_adding_a_photo_to_another_leads_contact_is_audited()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega");
        var admin = await factory.AddMemberAsync("Priya Shah");

        var response = await factory.ClientFor(admin, Role.SystemAdmin).UploadContactPhotoAsync(contact.Id, TestImages.Jpeg(), "a.jpg", "A photo");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Contains("contact.photo-added", await AdminActions(contact.Id, admin));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task A_photo_without_a_description_is_refused(string altText)
    {
        var (client, contact) = await OwnContact();

        var response = await client.UploadContactPhotoAsync(contact.Id, TestImages.Jpeg(), "a.jpg", altText);

        await AssertRefused(response, "AltText", "Describe this photo.", contact.Id);
    }

    [Fact]
    public async Task A_description_over_300_characters_is_refused()
    {
        var (client, contact) = await OwnContact();

        var response = await client.UploadContactPhotoAsync(contact.Id, TestImages.Jpeg(), "a.jpg", new string('a', 301));

        await AssertRefused(response, "AltText", "Use 300 characters or fewer to describe this photo.", contact.Id);
    }

    [Fact]
    public async Task A_file_over_5_mb_is_refused()
    {
        var (client, contact) = await OwnContact();

        var response = await client.UploadContactPhotoAsync(contact.Id, new byte[5 * 1024 * 1024 + 1], "team.jpg", "The team");

        await AssertRefused(response, "File", "team.jpg is 5.0 MB. Photos can be up to 5 MB — try a smaller one.", contact.Id);
    }

    [Fact]
    public async Task A_file_of_another_type_or_with_mismatched_content_is_refused()
    {
        var (client, contact) = await OwnContact();

        var gif = await client.UploadContactPhotoAsync(contact.Id, "GIF89a"u8.ToArray(), "party.gif", "A party");
        var fake = await client.UploadContactPhotoAsync(contact.Id, TestImages.Png(), "png-as-jpeg.jpg", "A photo");

        await AssertRefused(gif, "File", "party.gif isn’t a photo we can use. Photos must be JPEG, PNG or WebP.", contact.Id);
        await AssertRefused(fake, "File", "png-as-jpeg.jpg isn’t really a JPEG image. Choose a JPEG, PNG or WebP photo.", contact.Id);
    }

    [Fact]
    public async Task The_eleventh_photo_is_refused()
    {
        var (client, contact) = await OwnContact();
        await factory.WithDbAsync(async db =>
        {
            var stored = await db.Contacts.SingleAsync(c => c.Id == contact.Id);
            for (var i = 0; i < Domain.Contacts.Contact.MaxPhotos; i++)
            {
                stored.AddPhoto(new Domain.Contacts.ContactPhoto($"contacts/{contact.Id}/{i}.jpg", $"Photo {i}", DateTimeOffset.UtcNow.AddMinutes(i)));
            }

            return await db.SaveChangesAsync();
        });

        var response = await client.UploadContactPhotoAsync(contact.Id, TestImages.Jpeg(), "eleven.jpg", "One too many");

        var problem = await AssertValidationProblem(response);
        Assert.Equal(["That’s 10 photos, the most a contact can have. Remove one to add another."], problem.Errors["File"]);
        Assert.Equal(10, (await PhotosOf(contact.Id)).Count);
    }

    [Fact]
    public async Task An_upload_without_a_file_is_refused()
    {
        var (client, contact) = await OwnContact();

        var response = await client.PostAsync($"/api/contacts/{contact.Id}/photos", new MultipartFormDataContent { { new StringContent("A photo"), "altText" } });

        var problem = await AssertValidationProblem(response);
        Assert.Equal(["Choose a photo to upload."], problem.Errors["File"]);
    }

    private async Task<(HttpClient Client, Contact Contact)> OwnContact()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega");
        return (factory.ClientFor(grace, Role.CityLead), contact);
    }

    private Task<List<Domain.Contacts.ContactPhoto>> PhotosOf(Guid contactId) =>
        factory.WithDbAsync(async db => (await db.Contacts.AsNoTracking().SingleAsync(c => c.Id == contactId)).Photos.ToList());

    private Task<List<string>> AdminActions(Guid contactId, ProfileClients.Member admin) =>
        factory.WithDbAsync(db => db.AuditEntries.AsNoTracking()
            .Where(e => e.TargetId == contactId.ToString() && e.ActorId == admin.ProfileId).Select(e => e.Action).ToListAsync());

    private async Task AssertRefused(HttpResponseMessage response, string field, string message, Guid contactId)
    {
        var problem = await AssertValidationProblem(response);
        Assert.Equal([message], problem.Errors[field]);
        Assert.Empty(await PhotosOf(contactId));
        Assert.DoesNotContain(factory.Photos.Blobs.Keys, k => k.StartsWith($"{FaithTechSeed.OrganisationId}/contacts/{contactId}/"));
    }

    private static async Task<ValidationProblemDetails> AssertValidationProblem(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!;
    }
}
