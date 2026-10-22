// Traces to: L2-005
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Fakes;
using FaithTech.Community.Domain.Contacts;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Profiles;

public class ViewProfileTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly DateTimeOffset Earlier = new(2026, 10, 1, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Anonymous_visitor_gets_401_for_a_profile()
    {
        var samuel = await factory.AddMemberAsync("Samuel Mensah");

        var response = await factory.CreateClient().GetAsync($"/api/profiles/{samuel.ProfileId}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Member_sees_another_members_name_featured_photo_photos_and_roles()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var samuel = await factory.AddMemberAsync("Samuel Mensah", p =>
        {
            p.Update("Samuel Mensah", "Toronto", "Backend engineer.");
            p.AddRole(Role.CreateLead, Guid.Empty, DateTime.UtcNow);
            p.AddRole(Role.ProductEngineer, Guid.Empty, DateTime.UtcNow);
            p.AddPhoto(new ProfilePhoto($"profiles/{p.Id}/a.jpg", "Samuel at Builders Night", Earlier));
            p.AddPhoto(new ProfilePhoto($"profiles/{p.Id}/b.jpg", "The hackathon team", Earlier.AddDays(1)));
        });

        var profile = await factory.ClientFor(grace).GetFromJsonAsync<ProfileResponse>($"/api/profiles/{samuel.ProfileId}");

        Assert.Equal(samuel.ProfileId, profile!.Id);
        Assert.Equal("Samuel Mensah", profile.Name);
        Assert.Equal("Toronto", profile.HomeCity);
        Assert.Equal("Backend engineer.", profile.Bio);
        Assert.Equal(["CreateLead", "ProductEngineer"], profile.Roles);
        Assert.Equal(["The hackathon team", "Samuel at Builders Night"], profile.Photos.Select(p => p.AltText));
        Assert.Equal("Samuel at Builders Night", profile.FeaturedPhoto!.AltText);
        Assert.Equal($"{FakePhotoStorage.BaseUrl}profiles/{samuel.ProfileId}/a.jpg", profile.FeaturedPhoto.Url);
        Assert.False(profile.IsOwn);
        Assert.False(profile.CanEdit);
    }

    [Fact]
    public async Task Member_reads_their_own_profile_through_me_and_may_edit_it()
    {
        var leah = await factory.AddMemberAsync("Leah Thompson");

        var profile = await factory.ClientFor(leah).GetFromJsonAsync<ProfileResponse>("/api/profiles/me");

        Assert.Equal(leah.ProfileId, profile!.Id);
        Assert.Equal("Leah Thompson", profile.Name);
        Assert.Empty(profile.Roles);
        Assert.Empty(profile.Photos);
        Assert.Null(profile.FeaturedPhoto);
        Assert.True(profile.IsOwn);
        Assert.True(profile.CanEdit);
    }

    [Fact]
    public async Task System_admin_may_edit_any_profile()
    {
        var priya = await factory.AddMemberAsync("Priya Shah");
        var samuel = await factory.AddMemberAsync("Samuel Mensah");

        var profile = await factory.ClientFor(priya, Role.SystemAdmin)
            .GetFromJsonAsync<ProfileResponse>($"/api/profiles/{samuel.ProfileId}");

        Assert.False(profile!.IsOwn);
        Assert.True(profile.CanEdit);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Unlinked_private_contact_requested_as_a_profile_is_404(bool asSystemAdmin)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = new Contact(grace.ProfileId, "Tomás Ortega", "tomas@example.org", null, null, "Toronto", DateTime.UtcNow);
        var jonah = await factory.AddMemberAsync("Jonah Bell");
        var client = asSystemAdmin ? factory.ClientFor(jonah, Role.SystemAdmin) : factory.ClientFor(jonah);

        var response = await client.GetAsync($"/api/profiles/{contact.Id}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    public sealed record PhotoResponse(Guid Id, string Url, string AltText, bool IsFeatured, DateTimeOffset UploadedAt);

    public sealed record ProfileResponse(
        Guid Id,
        string Name,
        string? HomeCity,
        string? Bio,
        PhotoResponse? FeaturedPhoto,
        PhotoResponse[] Photos,
        string[] Roles,
        bool IsOwn,
        bool CanEdit);
}
