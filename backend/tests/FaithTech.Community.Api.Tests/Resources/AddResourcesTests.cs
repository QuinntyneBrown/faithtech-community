// Traces to: L2-057, L2-059, L2-066
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Resources.ResourceClients;

namespace FaithTech.Community.Api.Tests.Resources;

public class AddResourcesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private const string Refusal =
        "can’t be added. Use PPTX, PPT, KEY, PDF, DOCX, DOC, XLSX, CSV, PNG, JPG, SVG, GIF, WEBP, MP4 or ZIP, up to 100 MB. For longer video, add a link instead.";

    [Fact]
    public async Task A_lead_uploads_a_file_that_is_global_by_default_titled_from_its_name_and_typed_from_its_extension()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace, Role.CityLead).UploadAsync(Deck("city-launch-deck.pptx"), tags: [" Launch", "launch ", "Brand", ""]);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var added = Assert.Single((await response.Content.ReadFromJsonAsync<Detail[]>())!);
        Assert.Equal(("city-launch-deck", "Deck", "Global", grace.ProfileId), (added.Title, added.Type, added.Visibility, added.OwnerId));
        Assert.Equal(("city-launch-deck.pptx", "pptx", (long)Zip.Length), (added.FileName, added.Extension, added.Size));
        Assert.Equal(["launch", "brand"], added.Tags);
        Assert.Equal(factory.Time.GetUtcNow(), added.AddedAt);
        Assert.True(added.IsOwn && added.CanEdit && added.IsStored);
    }

    [Fact]
    public async Task The_download_returns_the_original_bytes_under_the_original_file_name()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var added = await factory.AddFileAsync(grace, new Upload("Volunteer Training.pdf", Pdf));
        var member = await factory.AddMemberAsync("Daniel Reyes");

        var response = await factory.ClientFor(member).GetAsync($"/api/resources/{added.Id}/file");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(Pdf, await response.Content.ReadAsByteArrayAsync());
        Assert.Equal("application/pdf", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal("Volunteer Training.pdf", response.Content.Headers.ContentDisposition!.FileNameStar);
        Assert.Equal("attachment", response.Content.Headers.ContentDisposition.DispositionType);
    }

    [Fact]
    public async Task Given_fields_override_the_guesses()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var added = await factory.AddFileAsync(grace, Deck(), new Dictionary<string, string>
        {
            ["title"] = "  City launch deck ", ["description"] = "The deck for a first city launch.", ["type"] = "Template", ["visibility"] = "Private",
        });

        Assert.Equal(("City launch deck", "The deck for a first city launch.", "Template", "Private"),
            (added.Title, added.Description, added.Type, added.Visibility));
    }

    [Fact]
    public async Task A_batch_makes_one_resource_per_file_with_the_shared_tags_and_visibility()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var form = Form(
            [new Upload("retro.pdf", Pdf), new Upload("logo.png", TestImages.Png()), Deck("pitch.pptx")],
            new Dictionary<string, string> { ["visibility"] = "Private" },
            ["launch"]);

        var response = await factory.ClientFor(grace, Role.EventLead).PostAsync("/api/resources", form);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var added = (await response.Content.ReadFromJsonAsync<Detail[]>())!;
        Assert.Equal([("retro", "Document"), ("logo", "Image"), ("pitch", "Deck")], added.Select(a => (a.Title, a.Type)));
        Assert.All(added, a => Assert.Equal(("Private", "launch"), (a.Visibility, a.Tags.Single())));
    }

    [Fact]
    public async Task More_than_twenty_files_in_one_request_are_refused()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var files = Enumerable.Range(1, 21).Select(i => new Upload($"file-{i}.pdf", Pdf));

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsync("/api/resources", Form(files));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await factory.WithDbAsync(db => db.Resources.CountAsync(r => r.OwnerId == grace.ProfileId)));
    }

    public static TheoryData<string, byte[]> RefusedFiles() => new()
    {
        { "setup.exe", [0x4D, 0x5A, 0x90, 0x00] },
        { "notes.txt", "plain text"u8.ToArray() },
        { "fake.pdf", TestImages.Png() },
        { "deck.pptx", Pdf },
    };

    [Theory]
    [MemberData(nameof(RefusedFiles))]
    public async Task A_file_with_another_extension_or_content_that_does_not_match_is_refused(string fileName, byte[] content)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace, Role.CityLead).UploadAsync(new Upload(fileName, content));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!;
        Assert.Equal($"{fileName} {Refusal}", problem.Errors["Files"].Single());
    }

    [Fact]
    public async Task A_file_over_100_MB_is_refused()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var big = new byte[100 * 1024 * 1024 + 1];
        Pdf.CopyTo(big, 0);

        var response = await factory.ClientFor(grace, Role.CityLead).UploadAsync(new Upload("huge.pdf", big));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await factory.WithDbAsync(db => db.Resources.CountAsync(r => r.OwnerId == grace.ProfileId)));
    }

    [Fact]
    public async Task A_request_with_no_file_is_refused()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsync("/api/resources", Form([]));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_file_request_that_also_carries_a_link_is_refused()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace, Role.CityLead)
            .UploadAsync(Deck(), new Dictionary<string, string> { ["url"] = "https://canva.com/design/1" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.EventLead)]
    [InlineData(Role.CreateLead)]
    [InlineData(Role.CommunicationsLead)]
    [InlineData(Role.Staff)]
    [InlineData(Role.SystemAdmin)]
    public async Task Leads_staff_and_system_admins_may_add(Role role)
    {
        var member = await factory.AddMemberAsync("Hannah Kim");

        var response = await factory.ClientFor(member, role).UploadAsync(Deck());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Theory]
    [InlineData(Role.Volunteer)]
    [InlineData(Role.ProductEngineer)]
    [InlineData(Role.Attendee)]
    public async Task Everyone_else_is_refused(Role role)
    {
        var member = await factory.AddMemberAsync("Samuel Mensah");

        var response = await factory.ClientFor(member, role).UploadAsync(Deck());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task A_member_with_no_role_is_refused()
    {
        var member = await factory.AddMemberAsync("Samuel Mensah");

        Assert.Equal(HttpStatusCode.Forbidden, (await factory.ClientFor(member).UploadAsync(Deck())).StatusCode);
    }

    [Fact]
    public async Task A_lead_whose_email_is_not_verified_is_refused()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        await factory.WithDbAsync(async db =>
        {
            var user = await db.Users.SingleAsync(u => u.Id == grace.UserId);
            user.EmailConfirmed = false;
            return await db.SaveChangesAsync();
        });

        var response = await factory.ClientFor(grace, Role.CityLead).UploadAsync(Deck());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("Verify your email before adding resources.", (await response.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
    }

    [Fact]
    public async Task An_anonymous_visitor_gets_401_for_every_resources_endpoint()
    {
        var client = factory.CreateClient();
        var id = Guid.NewGuid();

        foreach (var path in new[] { "/api/resources", $"/api/resources/{id}", $"/api/resources/{id}/file", $"/api/resources/{id}/thumbnail", "/api/resources/tags" })
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(path)).StatusCode);
        }

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsync("/api/resources", Form([Deck()]))).StatusCode);
    }

    [Fact]
    public async Task An_image_gets_a_png_thumbnail_and_other_files_do_not()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var image = await factory.AddFileAsync(grace, new Upload("whiteboard.jpg", TestImages.Jpeg(1200, 900)));
        var deck = await factory.AddFileAsync(grace, Deck());
        var client = factory.ClientFor(grace);

        var thumbnail = await client.GetAsync($"/api/resources/{image.Id}/thumbnail");

        Assert.True(image.HasThumbnail);
        Assert.Equal("image/png", thumbnail.Content.Headers.ContentType!.MediaType);
        Assert.Equal((480, 360), TestImages.Size(await thumbnail.Content.ReadAsByteArrayAsync()));
        Assert.False(deck.HasThumbnail);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/resources/{deck.Id}/thumbnail")).StatusCode);
    }

    [Fact]
    public async Task While_storage_is_down_the_resource_is_saved_and_its_file_is_stored_once_storage_recovers()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace, Role.CityLead);
        factory.Files.Down = true;
        Detail added;
        try
        {
            var response = await client.UploadAsync(new Upload("retro.pdf", Pdf));
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            added = (await response.Content.ReadFromJsonAsync<Detail[]>())!.Single();
            Assert.False(added.IsStored);
            Assert.Equal(HttpStatusCode.Conflict, (await client.GetAsync($"/api/resources/{added.Id}/file")).StatusCode);
        }
        finally
        {
            factory.Files.Down = false;
        }

        await factory.RunResourceStorageRetryAsync();

        var download = await client.GetAsync($"/api/resources/{added.Id}/file");
        Assert.Equal(Pdf, await download.Content.ReadAsByteArrayAsync());
        Assert.True((await client.GetFromJsonAsync<Detail>($"/api/resources/{added.Id}"))!.IsStored);
    }
}
