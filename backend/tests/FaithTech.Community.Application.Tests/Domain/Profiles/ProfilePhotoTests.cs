// Traces to: L2-007, L2-044
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Tests.Domain.Profiles;

public class ProfilePhotoTests
{
    private static readonly DateTimeOffset Start = new(2026, 10, 21, 12, 0, 0, TimeSpan.Zero);

    private static ProfilePhoto Photo(int minutes) => new($"photo-{minutes}.webp", $"Photo {minutes}", Start.AddMinutes(minutes));

    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    public void A_photo_needs_alt_text(string altText)
    {
        Assert.Throws<ArgumentException>(() => new ProfilePhoto("a.webp", altText, Start));
    }

    [Fact]
    public void A_photo_can_be_described_again()
    {
        var photo = Photo(1);

        photo.Describe("Grace speaking at Builders Night");

        Assert.Equal("Grace speaking at Builders Night", photo.AltText);
    }

    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    public void A_new_description_cannot_be_empty(string altText)
    {
        var photo = Photo(1);

        Assert.Throws<ArgumentException>(() => photo.Describe(altText));
        Assert.Equal("Photo 1", photo.AltText);
    }

    [Fact]
    public void The_first_photo_becomes_featured()
    {
        var profile = new Profile("Ada");

        profile.AddPhoto(Photo(1));
        profile.AddPhoto(Photo(2));

        Assert.Equal([true, false], profile.Photos.Select(p => p.IsFeatured));
    }

    [Fact]
    public void A_profile_holds_at_most_ten_photos()
    {
        var profile = new Profile("Ada");
        for (var i = 0; i < Profile.MaxPhotos; i++)
        {
            profile.AddPhoto(Photo(i));
        }

        Assert.Throws<InvalidOperationException>(() => profile.AddPhoto(Photo(11)));
        Assert.Equal(10, profile.Photos.Count);
    }

    [Fact]
    public void Featuring_a_photo_makes_it_the_only_featured_photo()
    {
        var profile = new Profile("Ada");
        var second = Photo(2);
        profile.AddPhoto(Photo(1));
        profile.AddPhoto(second);
        profile.AddPhoto(Photo(3));

        profile.Feature(second.Id);

        Assert.Equal(second.Id, Assert.Single(profile.Photos, p => p.IsFeatured).Id);
    }

    [Fact]
    public void Featuring_an_unknown_photo_is_rejected()
    {
        Assert.Throws<InvalidOperationException>(() => new Profile("Ada").Feature(Guid.NewGuid()));
    }

    [Fact]
    public void Removing_the_featured_photo_features_the_most_recently_uploaded_remaining_photo()
    {
        var profile = new Profile("Ada");
        var first = Photo(1);
        var newest = Photo(3);
        profile.AddPhoto(first);
        profile.AddPhoto(newest);
        profile.AddPhoto(Photo(2));

        profile.RemovePhoto(first.Id);

        Assert.Equal(newest.Id, Assert.Single(profile.Photos, p => p.IsFeatured).Id);
    }

    [Fact]
    public void Removing_another_photo_keeps_the_featured_photo()
    {
        var profile = new Profile("Ada");
        var first = Photo(1);
        var second = Photo(2);
        profile.AddPhoto(first);
        profile.AddPhoto(second);

        profile.RemovePhoto(second.Id);

        Assert.Equal(first.Id, Assert.Single(profile.Photos, p => p.IsFeatured).Id);
    }

    [Fact]
    public void Removing_the_last_photo_leaves_no_photo()
    {
        var profile = new Profile("Ada");
        var only = Photo(1);
        profile.AddPhoto(only);

        profile.RemovePhoto(only.Id);

        Assert.Empty(profile.Photos);
    }

    [Fact]
    public void Removing_an_unknown_photo_is_rejected()
    {
        Assert.Throws<InvalidOperationException>(() => new Profile("Ada").RemovePhoto(Guid.NewGuid()));
    }
}
