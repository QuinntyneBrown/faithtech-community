using FaithTech.Community.Application.Agile;
using Microsoft.AspNetCore.SignalR;

namespace FaithTech.Community.Api.Hubs;

/// <summary>
/// Live Agile updates (ADR 0009). Clients only join groups here; every change goes over HTTP to an
/// Application handler, which broadcasts through <see cref="SignalRAgileNotifier"/>. Holds no business logic.
/// </summary>
public class AgileHub(WorkspaceAccessPolicy policy, IHttpContextAccessor http) : Hub
{
    public static string BoardGroup(Guid workspaceId) => $"board:{workspaceId}";

    /// <summary>Starts receiving CardMoved for a board the caller may read; an outsider is refused (L2-031 AC6).</summary>
    public async Task WatchBoard(Guid workspaceId)
    {
        var (workspace, caller) = await LoadAsync(workspaceId);
        if (workspace is null || !caller.CanRead)
        {
            throw new HubException("You’re not a member of this workspace.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, BoardGroup(workspaceId));
    }

    // The policy reads the caller through ICurrentUser, which reads the current HTTP context; a hub
    // invocation is not a request, so point it at the connection's own context first.
    private Task<(Domain.Agile.Workspace? Workspace, WorkspaceCaller Caller)> LoadAsync(Guid workspaceId)
    {
        http.HttpContext = Context.GetHttpContext();
        return policy.LoadAsync(workspaceId, Context.ConnectionAborted);
    }
}
