using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using FaithTech.Community.Application.Profiles;

namespace FaithTech.Community.Infrastructure.Storage;

/// <summary>
/// Photos in the private profile-photos container. Profile photos are read through one-hour SAS URLs (ADR 0002);
/// contact photos are read by the API itself (ADR 0017).
/// </summary>
public class AzureBlobPhotoStorage(BlobServiceClient blobs, TimeProvider time) : IPhotoStorage
{
    public const string Container = "profile-photos";

    private static readonly TimeSpan ReadUrlLifetime = TimeSpan.FromHours(1);

    public string GetReadUrl(string key) =>
        Blob(key).GenerateSasUri(BlobSasPermissions.Read, time.GetUtcNow().Add(ReadUrlLifetime)).ToString();

    public async Task SaveAsync(string key, byte[] content, string contentType, CancellationToken cancellationToken = default)
    {
        await blobs.GetBlobContainerClient(Container).CreateIfNotExistsAsync(cancellationToken: cancellationToken);
        await Blob(key).UploadAsync(
            new BinaryData(content),
            new BlobUploadOptions { HttpHeaders = new BlobHttpHeaders { ContentType = contentType } },
            cancellationToken);
    }

    public async Task<StoredImage?> ReadAsync(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            var download = await Blob(key).DownloadContentAsync(cancellationToken);
            return new StoredImage(download.Value.Content.ToArray(), download.Value.Details.ContentType);
        }
        catch (RequestFailedException exception) when (exception.Status == 404)
        {
            return null;
        }
    }

    public Task DeleteAsync(string key, CancellationToken cancellationToken = default) =>
        Blob(key).DeleteIfExistsAsync(cancellationToken: cancellationToken);

    private BlobClient Blob(string key) => blobs.GetBlobContainerClient(Container).GetBlobClient(key);
}
