using System.Collections.Concurrent;
using FaithTech.Community.Application.Profiles;

namespace FaithTech.Community.Api.Tests.Fakes;

public class FakePhotoStorage : IPhotoStorage
{
    public const string BaseUrl = "https://photos.test/";

    public ConcurrentDictionary<string, (byte[] Content, string ContentType)> Blobs { get; } = new();

    public string GetReadUrl(string key) => BaseUrl + key;

    public Task SaveAsync(string key, byte[] content, string contentType, CancellationToken cancellationToken = default)
    {
        Blobs[key] = (content, contentType);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string key, CancellationToken cancellationToken = default)
    {
        Blobs.TryRemove(key, out _);
        return Task.CompletedTask;
    }
}
