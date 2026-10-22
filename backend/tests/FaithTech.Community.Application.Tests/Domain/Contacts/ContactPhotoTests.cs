// Traces to: L2-055, L2-056, L2-057
using FaithTech.Community.Domain.Contacts;

namespace FaithTech.Community.Application.Tests.Domain.Contacts;

public class ContactPhotoTests
{
    private static readonly DateTimeOffset Start = new(2026, 10, 22, 12, 0, 0, TimeSpan.Zero);

    private static Contact NewContact() => new(Guid.NewGuid(), "Tomás Ortega", null, null, null, null, Start.UtcDateTime);

    private static ContactPhoto Photo(int minutes) => new($"contacts/c/photo-{minutes}.jpg", $"Photo {minutes}", Start.AddMinutes(minutes));

    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    public void A_contact_photo_needs_a_description(string altText)
    {
        Assert.Throws<ArgumentException>(() => new ContactPhoto("a.jpg", altText, Start));
    }

    [Fact]
    public void A_contact_photo_can_be_described_again_but_not_emptied()
    {
        var photo = Photo(1);

        photo.Describe("Tomás at the coffee morning");
        Assert.Throws<ArgumentException>(() => photo.Describe(" "));

        Assert.Equal("Tomás at the coffee morning", photo.AltText);
    }

    [Fact]
    public void The_first_photo_of_a_contact_becomes_featured()
    {
        var contact = NewContact();

        contact.AddPhoto(Photo(1));
        contact.AddPhoto(Photo(2));

        Assert.Equal([true, false], contact.Photos.Select(p => p.IsFeatured));
    }

    [Fact]
    public void A_contact_holds_at_most_ten_photos()
    {
        var contact = NewContact();
        for (var i = 0; i < Contact.MaxPhotos; i++)
        {
            contact.AddPhoto(Photo(i));
        }

        Assert.Throws<InvalidOperationException>(() => contact.AddPhoto(Photo(99)));
        Assert.Equal(10, contact.Photos.Count);
    }

    [Fact]
    public void Featuring_a_photo_leaves_it_the_only_featured_one()
    {
        var contact = NewContact();
        contact.AddPhoto(Photo(1));
        var second = Photo(2);
        contact.AddPhoto(second);

        contact.Feature(second.Id);

        Assert.Equal([second.Id], contact.Photos.Where(p => p.IsFeatured).Select(p => p.Id));
    }

    [Fact]
    public void Deleting_the_featured_photo_features_the_newest_remaining_one()
    {
        var contact = NewContact();
        var first = Photo(1);
        var newest = Photo(3);
        contact.AddPhoto(first);
        contact.AddPhoto(newest);
        contact.AddPhoto(Photo(2));

        contact.RemovePhoto(first.Id);

        Assert.Equal([newest.Id], contact.Photos.Where(p => p.IsFeatured).Select(p => p.Id));
        Assert.Equal(2, contact.Photos.Count);
    }

    [Fact]
    public void A_photo_of_another_contact_cannot_be_featured_or_removed()
    {
        var contact = NewContact();
        contact.AddPhoto(Photo(1));

        Assert.Throws<InvalidOperationException>(() => contact.Feature(Guid.NewGuid()));
        Assert.Throws<InvalidOperationException>(() => contact.RemovePhoto(Guid.NewGuid()));
    }

    [Fact]
    public void A_photo_saved_while_storage_is_down_is_storing_until_stored()
    {
        var photo = Photo(1);

        photo.MarkStoring();
        Assert.False(photo.IsStored);
        photo.MarkStored();

        Assert.True(photo.IsStored);
    }
}
