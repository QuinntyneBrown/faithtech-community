namespace FaithTech.Community.Application.Resources;

/// <summary>
/// Where resource files and thumbnails live (ADR 0017): a sibling of photo storage on the same blob account, with
/// no read URL, so every read goes through the API's visibility check.
/// </summary>
public interface IFileStorage
{
    Task SaveAsync(string key, Stream content, string contentType, CancellationToken cancellationToken = default);

    Task<Stream> OpenReadAsync(string key, CancellationToken cancellationToken = default);

    Task DeleteAsync(string key, CancellationToken cancellationToken = default);
}
