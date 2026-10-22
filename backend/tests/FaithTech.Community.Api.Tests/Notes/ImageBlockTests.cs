// Traces to: L2-097, L2-092 AC5
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using static FaithTech.Community.Api.Tests.Notes.NoteClients;

namespace FaithTech.Community.Api.Tests.Notes;

public class ImageBlockTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private sealed record Uploaded(Guid ImageId);

    private const string Refusal = "Use a JPEG, PNG or WebP image up to 5 MB.";

    private static MultipartFormDataContent Form(string fileName, byte[] content)
    {
        var form = new MultipartFormDataContent();
        var part = new ByteArrayContent(content);
        part.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(part, "file", fileName);
        return form;
    }

    private static Task<HttpResponseMessage> UploadAsync(HttpClient client, Guid pageId, string fileName, byte[] content) =>
        client.PostAsync($"/api/notes/{pageId}/images", Form(fileName, content));

    [Fact]
    public async Task The_owner_uploads_an_image_that_readers_load_through_the_page()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var owner = factory.ClientFor(grace);
        var page = await factory.AddNoteAsync(grace, "Builders Night", "Global");

        var response = await UploadAsync(owner, page.Id, "whiteboard.png", TestImages.Png(800, 600));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var image = (await response.Content.ReadFromJsonAsync<Uploaded>())!;
        Assert.Contains(factory.Files.Blobs.Keys, k => k.StartsWith($"notes/{page.Id}/{image.ImageId}."));
        var read = await factory.ClientFor(await factory.AddMemberAsync("Marcus Lee")).GetAsync($"/api/notes/{page.Id}/images/{image.ImageId}");
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        Assert.StartsWith("image/", read.Content.Headers.ContentType!.MediaType);

        var saved = await owner.SaveNoteAsync(page, [Block("image", imageId: image.ImageId.ToString(), alt: "Pairing at the whiteboard")]);
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var detail = (await owner.GetFromJsonAsync<Detail>($"/api/notes/{page.Id}"))!;
        Assert.Equal("Pairing at the whiteboard", detail.Blocks[0]!["alt"]!.GetValue<string>());
    }

    [Fact]
    public async Task Only_the_owner_uploads_and_only_readers_of_the_page_load_its_images()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var page = await factory.AddNoteAsync(grace, "Private plan");
        var image = (await (await UploadAsync(factory.ClientFor(grace), page.Id, "plan.jpg", TestImages.Jpeg())).Content.ReadFromJsonAsync<Uploaded>())!;
        var global = await factory.AddNoteAsync(grace, "Playbook", "Global");
        var marcus = factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"), Role.CityLead);

        Assert.Equal(HttpStatusCode.NotFound, (await marcus.GetAsync($"/api/notes/{page.Id}/images/{image.ImageId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await UploadAsync(marcus, page.Id, "x.png", TestImages.Png())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await UploadAsync(marcus, global.Id, "x.png", TestImages.Png())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await factory.ClientFor(grace).GetAsync($"/api/notes/{global.Id}/images/{image.ImageId}")).StatusCode);
    }

    [Theory]
    [InlineData("deck.pdf")]
    [InlineData("fake.png")]
    [InlineData("huge.png")]
    public async Task Anything_but_a_JPEG_PNG_or_WebP_up_to_5_MB_is_refused(string fileName)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var page = await factory.ClientFor(grace).CreateNoteAsync("Images");
        var content = fileName switch
        {
            "deck.pdf" => Encoding.ASCII.GetBytes("%PDF-1.7 fake"),
            "fake.png" => Encoding.ASCII.GetBytes("not really a png"),
            _ => [.. TestImages.Png(), .. new byte[5 * 1024 * 1024]],
        };

        var response = await UploadAsync(factory.ClientFor(grace), page.Id, fileName, content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(Refusal, (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors.SelectMany(e => e.Value));
    }

    [Fact]
    public async Task An_image_block_needs_alt_text_and_an_image_uploaded_to_its_page()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace);
        var page = await client.CreateNoteAsync("Images");
        var other = await client.CreateNoteAsync("Other page");
        var image = (await (await UploadAsync(client, page.Id, "a.webp", TestImages.Webp())).Content.ReadFromJsonAsync<Uploaded>())!;
        var elsewhere = (await (await UploadAsync(client, other.Id, "b.png", TestImages.Png())).Content.ReadFromJsonAsync<Uploaded>())!;

        var noAlt = await client.SaveNoteAsync(page, [Block("image", imageId: image.ImageId.ToString(), alt: "  ")]);
        var longAlt = await client.SaveNoteAsync(page, [Block("image", imageId: image.ImageId.ToString(), alt: new string('a', 251))]);
        var foreign = await client.SaveNoteAsync(page, [Block("image", imageId: elsewhere.ImageId.ToString(), alt: "Board")]);

        Assert.Equal(HttpStatusCode.BadRequest, noAlt.StatusCode);
        Assert.Contains("Describe this image", (await noAlt.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors.SelectMany(e => e.Value));
        Assert.Equal(HttpStatusCode.BadRequest, longAlt.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, foreign.StatusCode);
    }

    [Fact]
    public async Task An_upload_while_storage_is_down_is_refused_without_saving_anything()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var page = await factory.ClientFor(grace).CreateNoteAsync("Images");
        factory.Files.Down = true;
        try
        {
            var response = await UploadAsync(factory.ClientFor(grace), page.Id, "a.png", TestImages.Png());

            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        }
        finally
        {
            factory.Files.Down = false;
        }
    }
}
