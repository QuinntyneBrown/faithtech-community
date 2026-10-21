// Traces to: L2-028 AC2
using FaithTech.Community.Application.Common;
using FaithTech.Community.Infrastructure.Email;
using MimeKit;

namespace FaithTech.Community.Infrastructure.Tests.Email;

public class EmailMimeTests
{
    private static readonly EmailMessage Message = new(
        "ruth@example.org",
        "Builders Night moves to Kestrel Labs",
        "Hannah Kim sent an announcement.\n\nBring a <laptop> & a friend.\n\nRead it: https://app.faithtech.test/announcements");

    [Fact]
    public void Every_email_carries_the_plain_text_part_and_an_html_alternative()
    {
        var mime = EmailMime.Build(Message, "FaithTech Community <no-reply@faithtech.community>");

        var parts = Assert.IsType<MultipartAlternative>(mime.Body);
        var text = Assert.IsType<TextPart>(parts[0]);
        var html = Assert.IsType<TextPart>(parts[1]);
        Assert.True(text.IsPlain);
        // Mail parts use CRLF line breaks; the words are the queued body's.
        Assert.Equal(Message.Body, text.Text.ReplaceLineEndings("\n"));
        Assert.True(html.IsHtml);
        Assert.Equal("Builders Night moves to Kestrel Labs", mime.Subject);
        Assert.Equal("ruth@example.org", mime.To.Mailboxes.Single().Address);
        Assert.Equal("no-reply@faithtech.community", mime.From.Mailboxes.Single().Address);
    }

    [Fact]
    public void The_html_part_escapes_the_text_and_makes_its_links_clickable()
    {
        var parts = Assert.IsType<MultipartAlternative>(EmailMime.Build(Message, "no-reply@faithtech.community").Body);
        var html = Assert.IsType<TextPart>(parts[1]).Text;

        Assert.Contains("<p>Bring a &lt;laptop&gt; &amp; a friend.</p>", html);
        Assert.Contains("<a href=\"https://app.faithtech.test/announcements\">https://app.faithtech.test/announcements</a>", html);
        Assert.DoesNotContain("<laptop>", html);
    }
}
