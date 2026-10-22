using System.Collections.Concurrent;
using FaithTech.Community.Application.Resources;

namespace FaithTech.Community.Api.Tests.Fakes;

public class FakeFileStorage : IFileStorage
{
    public ConcurrentDictionary<string, (byte[] Content, string ContentType)> Blobs { get; } = new();

    /// <summary>When set, every save, read and delete fails as an unreachable storage account would.</summary>
    public bool Down { get; set; }

    public async Task SaveAsync(string key, Stream content, string contentType, CancellationToken cancellationToken = default)
    {
        ThrowIfDown();
        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, cancellationToken);
        Blobs[key] = (buffer.ToArray(), contentType);
    }

    public Task<Stream> OpenReadAsync(string key, CancellationToken cancellationToken = default)
    {
        ThrowIfDown();
        return Task.FromResult<Stream>(new MemoryStream(Blobs[key].Content));
    }

    public Task DeleteAsync(string key, CancellationToken cancellationToken = default)
    {
        ThrowIfDown();
        Blobs.TryRemove(key, out _);
        return Task.CompletedTask;
    }

    private void ThrowIfDown()
    {
        if (Down)
        {
            throw new IOException("Blob storage is unavailable.");
        }
    }
}
