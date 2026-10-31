using FaithTech.Community.Application.Agile;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;

namespace FaithTech.Community.Api.Hubs;

/// <summary>
/// Live Agile updates (ADR 0012). Clients only join groups here; every change goes over HTTP to an
/// Application handler, which broadcasts through <see cref="SignalRAgileNotifier"/>. Holds no business logic.
/// </summary>
public class AgileHub(WorkspaceAccessPolicy policy, IApplicationDbContext db, IHttpContextAccessor http, ICurrentOrganisation organisation) : Hub
{
    // Group names start with the organisation's id, so a group never spans organisations (L2-130 AC2).
    public static string BoardGroup(Guid organisationId, Guid workspaceId) => $"{organisationId}:board:{workspaceId}";

    public static string PokerGroup(Guid organisationId, Guid sessionId) => $"{organisationId}:poker:{sessionId}";

    /// <summary>Starts receiving CardMoved for a board the caller may read; an outsider is refused (L2-031 AC6).</summary>
    public async Task WatchBoard(Guid workspaceId)
    {
        var (workspace, caller) = await LoadAsync(workspaceId);
        if (workspace is null || !caller.CanRead)
        {
            throw new HubException("You’re not a member of this workspace.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, BoardGroup(organisation.Id, workspaceId));
    }

    /// <summary>Starts receiving PokerChanged for a session the caller may read; Staff may watch, an outsider is refused (L2-038 AC7).</summary>
    public async Task WatchPokerSession(Guid sessionId)
    {
        var workspaceId = await db.PokerSessions.Where(s => s.Id == sessionId).Select(s => (Guid?)s.WorkspaceId)
            .SingleOrDefaultAsync(Context.ConnectionAborted);
        var (workspace, caller) = workspaceId is { } id ? await LoadAsync(id) : (null, null!);
        if (workspace is null || !caller.CanRead)
        {
            throw new HubException("You’re not a member of this workspace.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, PokerGroup(organisation.Id, sessionId));
    }

    // The policy reads the caller through ICurrentUser, which reads the current HTTP context; a hub
    // invocation is not a request, so point it at the connection's own context first.
    private Task<(Domain.Agile.Workspace? Workspace, WorkspaceCaller Caller)> LoadAsync(Guid workspaceId)
    {
        http.HttpContext = Context.GetHttpContext();
        return policy.LoadAsync(workspaceId, Context.ConnectionAborted);
    }
}
