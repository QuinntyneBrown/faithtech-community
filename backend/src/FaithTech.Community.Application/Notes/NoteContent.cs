using System.Text.Json;
using System.Text.Json.Serialization;
using FaithTech.Community.Domain.Notes;

namespace FaithTech.Community.Application.Notes;

/// <summary>Reads and writes a page's blocks as the JSON document stored on its row (ADR 0023).</summary>
public static class NoteContent
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static IReadOnlyList<NoteBlock> Read(string content) =>
        JsonSerializer.Deserialize<List<NoteBlock>>(content, Options) ?? [];

    public static string Write(IReadOnlyList<NoteBlock> blocks) => JsonSerializer.Serialize(blocks, Options);
}
