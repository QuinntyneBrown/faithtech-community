using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Notes;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Notes;

/// <summary>Note pages created through the API, and the shapes the notes endpoints answer with.</summary>
public static class NoteClients
{
    public sealed record Summary(
        Guid Id,
        string Title,
        string? Icon,
        Guid OwnerId,
        string OwnerName,
        bool IsOwn,
        string Visibility,
        bool SharedWithYou,
        DateTimeOffset UpdatedAt,
        string UpdatedByName);

    public sealed record SummaryPage(Summary[] Items, int Page, int PageSize, int TotalCount);

    public sealed record PageRef(Guid? Id, string Title, string? Icon);

    public sealed record AudienceMember(Guid Id, string Name, string? City);

    public sealed record AudienceRole(string Role, int Count);

    public sealed record Audience(AudienceMember[] Members, AudienceRole[] Roles);

    public sealed record Detail(
        Guid Id,
        string Title,
        string? Icon,
        Guid? ParentId,
        Guid OwnerId,
        string OwnerName,
        bool IsOwn,
        string Visibility,
        bool SharedWithYou,
        string? SharedVia,
        Audience Audience,
        JsonArray Blocks,
        int Version,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt,
        string UpdatedByName,
        DateTimeOffset? ArchivedAt,
        bool CanEdit,
        bool IsAdminView,
        PageRef[] Breadcrumb,
        PageRef[] Children,
        PageRef[] Backlinks);

    public sealed record Saved(int Version, DateTimeOffset UpdatedAt);

    public static async Task<Detail> CreateNoteAsync(this HttpClient client, string? title = null, Guid? parentId = null)
    {
        var response = await client.PostAsJsonAsync("/api/notes", new { Title = title, ParentId = parentId });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<Detail>())!;
    }

    public static async Task<Detail> AddNoteAsync(
        this CommunityApiFactory factory, ProfileClients.Member owner, string title, string visibility = "Private", params Role[] roles)
    {
        var client = factory.ClientFor(owner, roles);
        var page = await client.CreateNoteAsync(title);
        if (visibility != "Private")
        {
            await factory.WithDbAsync(async db =>
            {
                var stored = await db.NotePages.SingleAsync(p => p.Id == page.Id);
                stored.SetAudience(Enum.Parse<NoteVisibility>(visibility), [], []);
                return await db.SaveChangesAsync();
            });
        }

        return (await client.GetFromJsonAsync<Detail>($"/api/notes/{page.Id}"))!;
    }

    public static async Task<SummaryPage> ListNotesAsync(this HttpClient client, string query = "") =>
        (await client.GetFromJsonAsync<SummaryPage>($"/api/notes{query}"))!;

    public static Task<HttpResponseMessage> SaveNoteAsync(this HttpClient client, Detail page, object[] blocks, string? title = null, int? version = null, string? icon = null) =>
        client.PutAsJsonAsync($"/api/notes/{page.Id}", new { Title = title ?? page.Title, Icon = icon ?? page.Icon, Blocks = blocks, Version = version ?? page.Version });

    public static object Paragraph(string text, string? id = null) =>
        new { Id = id ?? Guid.NewGuid().ToString(), Type = "paragraph", Text = new[] { new { Text = text } } };

    public static object Block(string type, object[]? spans = null, string? id = null, bool? @checked = null, string? icon = null,
        string? url = null, string? caption = null, string? imageId = null, string? alt = null) =>
        new { Id = id ?? Guid.NewGuid().ToString(), Type = type, Text = spans, Checked = @checked, Icon = icon, Url = url, Caption = caption, ImageId = imageId, Alt = alt };

    public static object PageLink(Guid pageId, string text = "") => new { Text = text, PageId = pageId };

    public static string TextOf(JsonNode block) =>
        string.Concat(block["text"]!.AsArray().Select(s => s!["text"]!.GetValue<string>()));

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
}
