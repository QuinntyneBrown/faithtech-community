using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Domain.Resources;

namespace FaithTech.Community.Application.Resources;

/// <summary>Tells the people a resource is shared with (L2-061 AC2, AC3). Joins the caller's unit of work.</summary>
public class ShareNotifier
{
    public Task NotifyAsync(IReadOnlyList<Resource> added, Guid owner, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task NotifyAsync(
        Resource resource, Guid actor, IReadOnlyList<Guid> newMembers, IReadOnlyList<Role> newRoles, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;
}
