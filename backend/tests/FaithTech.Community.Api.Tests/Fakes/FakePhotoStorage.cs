using System.Collections.Concurrent;
using FaithTech.Community.Application.Profiles;

namespace FaithTech.Community.Api.Tests.Fakes;

public class FakePhotoStorage : IPhotoStorage
{
    public const string BaseUrl = "https://photos.test/";

    public string GetReadUrl(string key) => BaseUrl + key;
}
