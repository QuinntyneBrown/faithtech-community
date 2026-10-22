using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using FaithTech.Community.Application.Resources;

namespace FaithTech.Community.Infrastructure.Storage;

/// <summary>Resource files and thumbnails in the private resources container; read only through the API (ADR 0017).</summary>
public class AzureBlobFileStorage(BlobServiceClient blobs) : IFileStorage
{
    public const string Container = "resources";

    public async Task SaveAsync(string key, Stream content, string contentType, CancellationToken cancellationToken = default)
    {
        await blobs.GetBlobContainerClient(Container).CreateIfNotExistsAsync(cancellationToken: cancellationToken);
        await Blob(key).UploadAsync(
            content,
            new BlobUploadOptions { HttpHeaders = new BlobHttpHeaders { ContentType = contentType } },
            cancellationToken);
    }

    public async Task<Stream> OpenReadAsync(string key, CancellationToken cancellationToken = default) =>
        await Blob(key).OpenReadAsync(cancellationToken: cancellationToken);

    public Task DeleteAsync(string key, CancellationToken cancellationToken = default) =>
        Blob(key).DeleteIfExistsAsync(cancellationToken: cancellationToken);

    private BlobClient Blob(string key) => blobs.GetBlobContainerClient(Container).GetBlobClient(key);
}
