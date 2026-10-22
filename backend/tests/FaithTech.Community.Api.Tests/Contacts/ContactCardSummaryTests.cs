// Traces to: L2-072
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Contacts.ContactClients;

namespace FaithTech.Community.Api.Tests.Contacts;

/// <summary>The list rows carry what a person card shows: the featured photo, the note count and when it was added.</summary>
public class ContactCardSummaryTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task A_contact_with_photos_and_notes_lists_its_featured_photo_and_note_count()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace, Role.CityLead);
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega", notes: "Met at Builders Night.");
        await client.PostAsJsonAsync($"/api/contacts/{contact.Id}/notes", new { Body = "Wants to help." });
        var featured = await client.AddContactPhotoAsync(contact.Id, "Tomás smiling outside the shelter");
        await client.AddContactPhotoAsync(contact.Id, "Another photo");

        var row = Assert.Single(await client.ListContactsAsync(), r => r.Id == contact.Id);

        Assert.Equal(featured.Url, row.PhotoUrl);
        Assert.Equal("Tomás smiling outside the shelter", row.PhotoAltText);
        Assert.Equal(2, row.NoteCount);
        Assert.Equal(contact.CreatedAtUtc, row.CreatedAtUtc);
    }

    [Fact]
    public async Task A_contact_without_photos_or_whose_photo_is_storing_lists_no_photo()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace, Role.CityLead);
        var plain = await factory.CreateContactAsync(grace, "Kwame Asante");
        var storing = await factory.CreateContactAsync(grace, "Abby Brooks");
        factory.Photos.Down = true;
        await client.AddContactPhotoAsync(storing.Id);
        factory.Photos.Down = false;

        var rows = await client.ListContactsAsync();

        Assert.All(rows.Where(r => r.Id == plain.Id || r.Id == storing.Id), r => Assert.Null(r.PhotoUrl));
        Assert.Equal(0, rows.Single(r => r.Id == plain.Id).NoteCount);
    }

    [Fact]
    public async Task A_linked_contact_lists_the_members_name_and_featured_photo()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace, Role.CityLead);
        var tomas = await factory.AddMemberAsync("Tomás Ortega", p =>
            p.AddPhoto(new ProfilePhoto($"profiles/{p.Id}/me.jpg", "Tomás in his own words", DateTimeOffset.UtcNow)));
        var contact = await factory.CreateContactAsync(grace, "Tomás O.");
        await client.AddContactPhotoAsync(contact.Id, "The lead's own photo");
        await factory.WithDbAsync(async db =>
        {
            (await db.Contacts.SingleAsync(c => c.Id == contact.Id)).LinkTo(tomas.ProfileId);
            return await db.SaveChangesAsync();
        });

        var row = Assert.Single(await client.ListContactsAsync(), r => r.Id == contact.Id);

        Assert.Equal("Tomás Ortega", row.Name);
        Assert.Equal($"{Fakes.FakePhotoStorage.BaseUrl}profiles/{tomas.ProfileId}/me.jpg", row.PhotoUrl);
        Assert.Equal("Tomás in his own words", row.PhotoAltText);
    }
}
