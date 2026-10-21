using Azure.Storage.Blobs;
using Azure.Storage.Sas;
using FaithTech.Community.Application.Profiles;

namespace FaithTech.Community.Infrastructure.Storage;

/// <summary>Profile photos in the private profile-photos container, read through one-hour SAS URLs (ADR 0002).</summary>
public class AzureBlobPhotoStorage(BlobServiceClient blobs, TimeProvider time) : IPhotoStorage
{
    public const string Container = "profile-photos";

    private static readonly TimeSpan ReadUrlLifetime = TimeSpan.FromHours(1);

    public string GetReadUrl(string key) =>
        blobs.GetBlobContainerClient(Container).GetBlobClient(key)
            .GenerateSasUri(BlobSasPermissions.Read, time.GetUtcNow().Add(ReadUrlLifetime))
            .ToString();
}
