// Traces to: L2-028 AC2, L2-030 AC3 (issue #173)
using System.Text.RegularExpressions;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Infrastructure.Email;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Infrastructure.Tests.Email;

public partial class EmailTemplateRendererTests
{
    private const string Origin = "https://app.faithtech.test";

    private static readonly EmailMessage Invite = new(
        "nate@example.org",
        "Grace invited you to FaithTech Community",
        new EmailContent(
            "You’re invited",
            ["Grace Okonkwo invited you to join FaithTech Community as a Product Engineer.", "“Bring <b>friends</b> & ideas”\n— Grace"],
            new EmailAction("Accept invite", "/accept-invite/abc123")),
        "Invite",
        "invite-1");

    [Fact]
    public void The_text_and_html_parts_say_the_same_thing()
    {
        var (text, html) = Renderer().Render(Invite);

        Assert.StartsWith("You’re invited\n\nGrace Okonkwo invited you to join FaithTech Community as a Product Engineer.", text);
        Assert.Contains($"Accept invite:\n{Origin}/accept-invite/abc123", text);
        Assert.Contains(EmailTemplateRenderer.StandardFooter, text);
        Assert.Contains("<p class=\"email__title\"", html);
        Assert.Contains(">You’re invited</p>", html);
        Assert.Contains("Grace Okonkwo invited you to join FaithTech Community as a Product Engineer.", html);
        Assert.Contains($"<a class=\"email__button\"", html);
        Assert.Contains($"href=\"{Origin}/accept-invite/abc123\">Accept invite</a>", html);
        Assert.Contains(EmailTemplateRenderer.StandardFooter, html);
    }

    [Fact]
    public void User_text_stays_text_in_the_html_part()
    {
        var (text, html) = Renderer().Render(Invite);

        Assert.Contains("“Bring <b>friends</b> & ideas”", text);
        Assert.Contains("“Bring &lt;b&gt;friends&lt;/b&gt; &amp; ideas”<br>— Grace", html);
        Assert.DoesNotContain("<b>", html);
    }

    [Fact]
    public void The_html_part_uses_the_design_systems_light_tokens_not_typed_values()
    {
        var (_, html) = Renderer().Render(Invite);

        // color-accent and color-fg-on-accent of tokens.css's light theme, on the .email__button rule.
        Assert.Contains("background:#7c3aed;color:#ffffff", html);
        Assert.DoesNotContain("var(--", html);
        Assert.DoesNotContain("{", Regex.Replace(html, "<title>.*</title>", string.Empty));
    }

    [Fact]
    public void Every_link_uses_the_configured_https_origin()
    {
        var announcement = Invite with
        {
            Content = Invite.Content with { UnsubscribePath = "/unsubscribe?token=t0k3n" },
        };

        var (text, html) = Renderer().Render(announcement);

        Assert.All(Links().Matches(text).Select(m => m.Value), link => Assert.StartsWith($"{Origin}/", link));
        Assert.All(Hrefs().Matches(html).Select(m => m.Groups[1].Value), link => Assert.StartsWith($"{Origin}/", link));
        Assert.Contains($"href=\"{Origin}/unsubscribe?token=t0k3n\">{EmailTemplateRenderer.UnsubscribeLabel}</a>", html);
        Assert.DoesNotContain(EmailTemplateRenderer.StandardFooter, html);
    }

    [Theory]
    [InlineData("http://app.faithtech.test")]
    [InlineData("ftp://app.faithtech.test")]
    [InlineData("")]
    public void An_insecure_origin_is_refused_instead_of_emitting_insecure_links(string origin)
    {
        Assert.Throws<InvalidOperationException>(() => Renderer(origin).Render(Invite));
    }

    [Fact]
    public void Links_must_be_app_paths()
    {
        var offsite = Invite with { Content = Invite.Content with { Action = new EmailAction("Go", "//evil.example/x") } };

        Assert.Throws<ArgumentException>(() => Renderer().Render(offsite));
    }

    private static EmailTemplateRenderer Renderer(string origin = Origin) =>
        new(Options.Create(new WebAppOptions { Origin = origin }));

    [GeneratedRegex(@"\b\w+://\S+")]
    private static partial Regex Links();

    [GeneratedRegex("href=\"([^\"]+)\"")]
    private static partial Regex Hrefs();
}
