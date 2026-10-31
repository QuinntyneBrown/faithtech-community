using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Resources;

/// <summary>Resources added through the API, the files they carry, and the shapes the endpoints answer with.</summary>
public static class ResourceClients
{
    public sealed record Summary(
        Guid Id,
        string Title,
        string Type,
        string TypeName,
        string? FileName,
        string? Extension,
        long? Size,
        string? LinkUrl,
        string? LinkHost,
        Guid OwnerId,
        string OwnerName,
        bool IsOwn,
        string Visibility,
        bool SharedWithYou,
        bool HasThumbnail,
        bool IsStored,
        DateTimeOffset AddedAt);

    public sealed record ResourcePage(Summary[] Items, int Page, int PageSize, int TotalCount);

    public sealed record AudienceMember(Guid Id, string Name, string? City);

    public sealed record AudienceRole(string Role, int Count);

    public sealed record Audience(AudienceMember[] Members, AudienceRole[] Roles);

    public sealed record Detail(
        Guid Id,
        string Title,
        string? Description,
        string Type,
        string TypeName,
        string[] Tags,
        string? FileName,
        string? Extension,
        long? Size,
        string? LinkUrl,
        string? LinkHost,
        Guid OwnerId,
        string OwnerName,
        bool IsOwn,
        string Visibility,
        bool SharedWithYou,
        string? SharedVia,
        Audience Audience,
        bool HasThumbnail,
        bool IsStored,
        DateTimeOffset AddedAt,
        DateTimeOffset? UpdatedAt,
        string? UpdatedByName,
        DateTimeOffset? FileReplacedAt,
        string? FileReplacedByName,
        DateTimeOffset? ArchivedAt,
        DateTimeOffset? PurgeAt,
        bool CanEdit,
        bool CanTransfer,
        string? OwnerLostRole);

    public sealed record Tag(string Name, int Count);

    public sealed record Upload(string FileName, byte[] Content);

    public static readonly byte[] Pdf = Encoding.ASCII.GetBytes("%PDF-1.7\n1 0 obj << >> endobj\n%%EOF");

    /// <summary>The start of a ZIP container, as PPTX, DOCX, XLSX and KEY files are.</summary>
    public static readonly byte[] Zip = [0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00];

    public static Upload Deck(string name = "city-launch-deck.pptx") => new(name, Zip);

    public static MultipartFormDataContent Form(IEnumerable<Upload> files, IDictionary<string, string>? fields = null, IEnumerable<string>? tags = null)
    {
        var form = new MultipartFormDataContent();
        foreach (var file in files)
        {
            var part = new ByteArrayContent(file.Content);
            part.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            form.Add(part, "files", file.FileName);
        }

        foreach (var (key, value) in fields ?? new Dictionary<string, string>())
        {
            form.Add(new StringContent(value), key);
        }

        foreach (var tag in tags ?? [])
        {
            form.Add(new StringContent(tag), "tags");
        }

        return form;
    }

    public static Task<HttpResponseMessage> UploadAsync(
        this HttpClient client, Upload file, IDictionary<string, string>? fields = null, IEnumerable<string>? tags = null) =>
        client.PostAsync("/api/resources", Form([file], fields, tags));

    public static async Task<Detail> AddFileAsync(
        this CommunityApiFactory factory, ProfileClients.Member owner, Upload? file = null,
        IDictionary<string, string>? fields = null, IEnumerable<string>? tags = null, Role role = Role.CityLead)
    {
        var response = await factory.ClientFor(owner, role).UploadAsync(file ?? Deck(), fields, tags);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<Detail[]>())!.Single();
    }

    public static async Task<ResourcePage> ListResourcesAsync(this HttpClient client, string query = "") =>
        (await client.GetFromJsonAsync<ResourcePage>($"/api/resources{query}"))!;

    public static object EditBody(Detail resource, string? title = null, string? visibility = null,
        Guid[]? memberIds = null, string[]? roles = null, string[]? tags = null, string? type = null, string? description = null) => new
        {
            Title = title ?? resource.Title,
            Description = description ?? resource.Description,
            Type = type ?? resource.Type,
            Tags = tags ?? resource.Tags,
            Visibility = visibility ?? resource.Visibility,
            MemberIds = memberIds ?? [],
            Roles = roles ?? [],
            Url = resource.LinkUrl,
        };
}
