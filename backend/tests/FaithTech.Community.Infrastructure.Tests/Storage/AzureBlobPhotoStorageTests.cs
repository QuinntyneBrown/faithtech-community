// Traces to: L2-005 (photo URLs, ADR 0002)
using System.Web;
using Azure.Storage.Blobs;
using FaithTech.Community.Infrastructure.Storage;
using Microsoft.Extensions.Time.Testing;

namespace FaithTech.Community.Infrastructure.Tests.Storage;

public class AzureBlobPhotoStorageTests
{
    // The well-known development storage account: SAS URLs are signed offline with its key.
    private static readonly BlobServiceClient Blobs = new("UseDevelopmentStorage=true");

    [Fact]
    public void Read_url_is_a_read_only_sas_for_the_key_that_expires_after_an_hour()
    {
        var now = new DateTimeOffset(2026, 10, 21, 12, 0, 0, TimeSpan.Zero);
        var storage = new AzureBlobPhotoStorage(Blobs, new FakeTimeProvider(now));

        var url = new Uri(storage.GetReadUrl("profiles/p1/ph1.jpg"));
        var query = HttpUtility.ParseQueryString(url.Query);

        Assert.EndsWith($"/{AzureBlobPhotoStorage.Container}/profiles/p1/ph1.jpg", url.AbsolutePath);
        Assert.Equal("r", query["sp"]);
        Assert.Equal(now.AddHours(1), DateTimeOffset.Parse(query["se"]!));
        Assert.False(string.IsNullOrEmpty(query["sig"]));
    }
}
