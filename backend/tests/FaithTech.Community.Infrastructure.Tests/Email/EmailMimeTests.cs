// Traces to: L2-028 AC2, L2-022 AC1 (issue #173)
using System.Text;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Infrastructure.Email;
using MimeKit;

namespace FaithTech.Community.Infrastructure.Tests.Email;

public class EmailMimeTests
{
    private const string Ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nSUMMARY:Toronto Builders Night\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";

    private static readonly OutgoingEmail Message = new(
        "ruth@example.org",
        "Builders Night moves to Kestrel Labs",
        "Builders Night moves to Kestrel Labs\n\nBring a <laptop> & a friend.",
        "<!doctype html><html><body><p>Bring a &lt;laptop&gt; &amp; a friend.</p></body></html>");

    [Fact]
    public void Every_email_carries_the_plain_text_part_and_its_html_alternative()
    {
        var mime = EmailMime.Build(Message, "FaithTech Community <no-reply@faithtech.community>");

        var parts = Assert.IsType<MultipartAlternative>(mime.Body);
        var text = Assert.IsType<TextPart>(parts[0]);
        var html = Assert.IsType<TextPart>(parts[1]);
        Assert.True(text.IsPlain);
        // Mail parts use CRLF line breaks; the words are the queued text part's.
        Assert.Equal(Message.Text, text.Text.ReplaceLineEndings("\n"));
        Assert.True(html.IsHtml);
        Assert.Equal(Message.Html, html.Text);
        Assert.Equal("Builders Night moves to Kestrel Labs", mime.Subject);
        Assert.Equal("ruth@example.org", mime.To.Mailboxes.Single().Address);
        Assert.Equal("no-reply@faithtech.community", mime.From.Mailboxes.Single().Address);
    }

    [Fact]
    public void An_attachment_rides_beside_both_alternatives_and_survives_serialization()
    {
        var withCalendar = Message with { Attachments = [new EmailAttachment("toronto-builders-night.ics", "text/calendar", Ics)] };
        using var stream = new MemoryStream();
        EmailMime.Build(withCalendar, "no-reply@faithtech.community").WriteTo(stream);
        stream.Position = 0;

        var parsed = MimeMessage.Load(stream);

        var mixed = Assert.IsType<Multipart>(parsed.Body);
        Assert.Equal("mixed", mixed.ContentType.MediaSubtype);
        var alternatives = Assert.IsType<MultipartAlternative>(mixed[0]);
        Assert.Equal(2, alternatives.Count);
        var calendar = Assert.IsAssignableFrom<MimePart>(mixed[1]);
        Assert.Equal("toronto-builders-night.ics", calendar.FileName);
        Assert.Equal("text/calendar", calendar.ContentType.MimeType);
        using var content = new MemoryStream();
        calendar.Content!.DecodeTo(content);
        Assert.Equal(Ics, Encoding.UTF8.GetString(content.ToArray()));
    }
}
