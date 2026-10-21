using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Agile;

/// <summary>Workspaces stored directly, and the people who own, join, read and override them.</summary>
public static class AgileClients
{
    private static readonly Guid Granter = Guid.NewGuid();

    public record Cast(
        ProfileClients.Member Owner,
        ProfileClients.Member Member,
        ProfileClients.Member Staff,
        ProfileClients.Member Admin,
        ProfileClients.Member Outsider,
        Guid WorkspaceId);

    public static Task<ProfileClients.Member> AddWithRolesAsync(this CommunityApiFactory factory, string name, params Role[] roles) =>
        factory.AddMemberAsync(name, p =>
        {
            foreach (var role in roles)
            {
                p.AddRole(role, Granter, DateTime.UtcNow);
            }
        });

    /// <summary>Stores a workspace owned by <paramref name="owner"/> with the given members.</summary>
    public static Task<Guid> AddWorkspaceAsync(
        this CommunityApiFactory factory, ProfileClients.Member owner, string name = "Toronto team",
        WorkspaceMethod method = WorkspaceMethod.Scrum, params ProfileClients.Member[] members) =>
        factory.WithDbAsync(async db =>
        {
            var workspace = new Workspace(name, method, owner.ProfileId);
            foreach (var member in members)
            {
                workspace.AddMember(await db.Profiles.SingleAsync(p => p.Id == member.ProfileId), factory.Time.GetUtcNow());
            }

            db.Workspaces.Add(workspace);
            await db.SaveChangesAsync();
            return workspace.Id;
        });

    /// <summary>A Scrum workspace with an owner (City Lead), one volunteer member, and Staff, System Admin and an outsider.</summary>
    public static async Task<Cast> AddCastAsync(this CommunityApiFactory factory, WorkspaceMethod method = WorkspaceMethod.Scrum)
    {
        var owner = await factory.AddWithRolesAsync("Grace Okonkwo", Role.CityLead);
        var member = await factory.AddWithRolesAsync("Ruth Alvarez", Role.Volunteer);
        var staff = await factory.AddWithRolesAsync("Daniel Reyes", Role.Staff);
        var admin = await factory.AddWithRolesAsync("Priya Shah", Role.SystemAdmin);
        var outsider = await factory.AddWithRolesAsync("Leah Thompson", Role.Volunteer);
        var id = await factory.AddWorkspaceAsync(owner, "Toronto team", method, member);
        return new Cast(owner, member, staff, admin, outsider, id);
    }

    public static HttpClient OwnerClient(this CommunityApiFactory factory, Cast cast) => factory.ClientFor(cast.Owner, Role.CityLead);

    public static HttpClient MemberClient(this CommunityApiFactory factory, Cast cast) => factory.ClientFor(cast.Member, Role.Volunteer);

    public static HttpClient StaffClient(this CommunityApiFactory factory, Cast cast) => factory.ClientFor(cast.Staff, Role.Staff);

    public static HttpClient AdminClient(this CommunityApiFactory factory, Cast cast) => factory.ClientFor(cast.Admin, Role.SystemAdmin);

    public static HttpClient OutsiderClient(this CommunityApiFactory factory, Cast cast) => factory.ClientFor(cast.Outsider, Role.Volunteer);

    public static Task<Workspace> LoadWorkspaceAsync(this CommunityApiFactory factory, Guid id) =>
        factory.WithDbAsync(db => db.Workspaces.IgnoreQueryFilters().AsNoTracking().SingleAsync(w => w.Id == id));

    public static Task<string> EmailOfAsync(this CommunityApiFactory factory, ProfileClients.Member member) =>
        factory.WithDbAsync(db => db.Users.Where(u => u.Id == member.UserId).Select(u => u.Email!).SingleAsync());
}
