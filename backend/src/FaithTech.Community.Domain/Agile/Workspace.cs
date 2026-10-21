using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Domain.Team;

namespace FaithTech.Community.Domain.Agile;

public class Workspace
{
    private readonly List<WorkspaceMember> _members = [];

    private Workspace() { }

    public Workspace(string name, WorkspaceMethod method, Guid ownerId)
    {
        Id = Guid.NewGuid();
        Rename(name);
        Method = method;
        OwnerId = ownerId;
    }

    public Guid Id { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public WorkspaceMethod Method { get; private set; }

    public Guid OwnerId { get; private set; }

    public bool IsArchived { get; private set; }

    public IReadOnlyCollection<WorkspaceMember> Members => _members;

    public void Rename(string name)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        Name = name;
    }

    public bool IsMember(Guid profileId) => profileId == OwnerId || _members.Any(m => m.ProfileId == profileId);

    public void AddMember(Profile profile, DateTimeOffset now)
    {
        if (!TeamRoles.IsTeamMember(profile))
        {
            throw new InvalidOperationException("Only a profile holding a lead or volunteer role can join a workspace.");
        }

        if (IsMember(profile.Id))
        {
            throw new InvalidOperationException("The profile is already a member of the workspace.");
        }

        _members.Add(new WorkspaceMember(Id, profile.Id, now));
    }

    public void RemoveMember(Guid profileId, IEnumerable<WorkItem> items)
    {
        var member = _members.FirstOrDefault(m => m.ProfileId == profileId)
            ?? throw new InvalidOperationException("The profile is not a removable member of the workspace.");

        _members.Remove(member);
        foreach (var item in items.Where(i => i.WorkspaceId == Id && i.AssigneeId == profileId))
        {
            item.Unassign();
        }
    }

    public void StartSprint(Sprint sprint, IEnumerable<Sprint> sprints, IEnumerable<WorkItem> stories)
    {
        if (Method != WorkspaceMethod.Scrum)
        {
            throw new InvalidOperationException("Sprints run only in a Scrum workspace.");
        }

        if (sprint.WorkspaceId != Id || sprint.State != SprintState.Planned)
        {
            throw new InvalidOperationException("Only a planned sprint of this workspace can start.");
        }

        var storyList = stories.ToList();
        foreach (var active in sprints.Where(s => s.WorkspaceId == Id && s.State == SprintState.Active))
        {
            active.Close(storyList);
        }

        sprint.Start();
    }

    public void SwitchMethod(WorkspaceMethod target, IEnumerable<Sprint> sprints, IEnumerable<WorkItem> stories)
    {
        if (target == Method)
        {
            throw new InvalidOperationException($"The workspace already uses {target}.");
        }

        var storyList = stories.Where(s => s.WorkspaceId == Id).ToList();
        if (target == WorkspaceMethod.Kanban)
        {
            foreach (var open in sprints.Where(s => s.WorkspaceId == Id && s.State != SprintState.Closed))
            {
                open.Close(storyList);
            }
        }
        else
        {
            foreach (var story in storyList.Where(s => s.Kind == WorkItemKind.Story && s.Status != WorkItemStatus.Done))
            {
                story.ReturnToBacklog();
            }
        }

        Method = target;
    }

    public void Archive()
    {
        if (IsArchived)
        {
            throw new InvalidOperationException("The workspace is already archived.");
        }

        IsArchived = true;
    }

    public void Restore()
    {
        if (!IsArchived)
        {
            throw new InvalidOperationException("The workspace is not archived.");
        }

        IsArchived = false;
    }

    public void ReassignOwner(Profile newOwner)
    {
        if (!newOwner.HasRole(Role.CityLead))
        {
            throw new InvalidOperationException("A workspace owner must hold the City Lead role.");
        }

        OwnerId = newOwner.Id;
    }
}
