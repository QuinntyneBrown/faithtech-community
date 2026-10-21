using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace FaithTech.Community.Api.Tests.Fakes;

public class FakeBlobServiceClient : BlobServiceClient
{
    public bool Reachable { get; set; } = true;

    public override Task<Response<BlobServiceProperties>> GetPropertiesAsync(CancellationToken cancellationToken = default) =>
        Reachable
            ? Task.FromResult(Response.FromValue(new BlobServiceProperties(), null!))
            : throw new RequestFailedException("Blob storage is unreachable.");
}
