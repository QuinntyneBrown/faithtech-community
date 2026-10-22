using System.Collections.Concurrent;
using FaithTech.Community.Application.Profiles;

namespace FaithTech.Community.Api.Tests.Fakes;

public class FakePhotoStorage : IPhotoStorage
{
    public const string BaseUrl = "https://photos.test/";

    public ConcurrentDictionary<string, (byte[] Content, string ContentType)> Blobs { get; } = new();

    /// <summary>When set, every save and delete fails as an unreachable storage account would.</summary>
    public bool Down { get; set; }

    public string GetReadUrl(string key) => BaseUrl + key;

    public Task SaveAsync(string key, byte[] content, string contentType, CancellationToken cancellationToken = default)
    {
        ThrowIfDown();
        Blobs[key] = (content, contentType);
        return Task.CompletedTask;
    }

    public Task<StoredImage?> ReadAsync(string key, CancellationToken cancellationToken = default)
    {
        ThrowIfDown();
        return Task.FromResult(Blobs.TryGetValue(key, out var blob) ? new StoredImage(blob.Content, blob.ContentType) : null);
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
