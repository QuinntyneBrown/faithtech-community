// Traces to: L2-012, L2-013, L2-014, L2-015, L2-016
using FaithTech.Community.Domain.Contacts;

namespace FaithTech.Community.Application.Tests.Domain.Contacts;

public class ContactTests
{
    private static readonly DateTime Now = new(2026, 10, 21, 12, 0, 0, DateTimeKind.Utc);
    private static readonly Guid Owner = Guid.NewGuid();

    private static Contact NewContact() => new(Owner, "Grace Hopper", "grace@example.org", "555-0100", "Navy", "Arlington", Now);

    [Fact]
    public void A_contact_belongs_to_the_lead_who_created_it()
    {
        var contact = NewContact();

        Assert.Equal(
            (Owner, "Grace Hopper", (string?)"grace@example.org", (string?)"555-0100", (string?)"Navy", (string?)"Arlington"),
            (contact.OwnerId, contact.Name, contact.Email, contact.Phone, contact.Organization, contact.City));
        Assert.False(contact.IsArchived);
        Assert.Null(contact.LinkedProfileId);
        Assert.Equal(Now, contact.CreatedAtUtc);
    }

    [Fact]
    public void A_contact_needs_a_name()
    {
        Assert.Throws<ArgumentException>(() => new Contact(Owner, " ", null, null, null, null, Now));
    }

    [Fact]
    public void Updating_changes_the_details_but_not_the_owner()
    {
        var contact = NewContact();

        contact.Update("Grace B. Hopper", null, "555-0199", "Yale", null);

        Assert.Equal(
            (Owner, "Grace B. Hopper", (string?)null, (string?)"555-0199", (string?)"Yale", (string?)null),
            (contact.OwnerId, contact.Name, contact.Email, contact.Phone, contact.Organization, contact.City));
    }

    [Fact]
    public void Updating_with_an_empty_name_is_rejected()
    {
        Assert.Throws<ArgumentException>(() => NewContact().Update("", null, null, null, null));
    }

    [Fact]
    public void A_note_is_saved_with_a_timestamp()
    {
        var contact = NewContact();

        var note = contact.AddNote("Met at the hackathon.", Now);

        Assert.Equal((contact.Id, "Met at the hackathon.", Now), (note.ContactId, note.Body, note.CreatedAtUtc));
        Assert.Equal([note], contact.Notes);
    }

    [Fact]
    public void A_note_needs_a_body()
    {
        Assert.Throws<ArgumentException>(() => NewContact().AddNote("  ", Now));
    }

    [Fact]
    public void Archiving_hides_the_contact_and_restoring_brings_it_back_with_its_notes()
    {
        var contact = NewContact();
        contact.AddNote("Follow up in spring.", Now);

        contact.Archive(Now);
        Assert.Equal((true, (DateTime?)Now), (contact.IsArchived, contact.ArchivedAtUtc));

        contact.Restore();
        Assert.Equal((false, (DateTime?)null), (contact.IsArchived, contact.ArchivedAtUtc));
        Assert.Single(contact.Notes);
    }

    [Fact]
    public void Archiving_an_archived_contact_is_rejected()
    {
        var contact = NewContact();
        contact.Archive(Now);

        Assert.Throws<InvalidOperationException>(() => contact.Archive(Now));
    }

    [Fact]
    public void Restoring_an_active_contact_is_rejected()
    {
        Assert.Throws<InvalidOperationException>(() => NewContact().Restore());
    }

    [Fact]
    public void Only_an_archived_contact_can_be_deleted_permanently()
    {
        var contact = NewContact();
        Assert.False(contact.CanBeDeleted);

        contact.Archive(Now);
        Assert.True(contact.CanBeDeleted);
    }

    [Fact]
    public void Linking_keeps_the_private_notes()
    {
        var contact = NewContact();
        contact.AddNote("Private.", Now);
        var profileId = Guid.NewGuid();

        contact.LinkTo(profileId);

        Assert.Equal(profileId, contact.LinkedProfileId);
        Assert.Single(contact.Notes);
    }

    [Fact]
    public void Linking_and_discarding_notes_deletes_the_private_notes()
    {
        var contact = NewContact();
        contact.AddNote("Private.", Now);

        contact.LinkTo(Guid.NewGuid(), discardNotes: true);

        Assert.Empty(contact.Notes);
    }

    [Fact]
    public void A_linked_contact_cannot_be_linked_again()
    {
        var contact = NewContact();
        contact.LinkTo(Guid.NewGuid());

        Assert.Throws<InvalidOperationException>(() => contact.LinkTo(Guid.NewGuid()));
    }
}
