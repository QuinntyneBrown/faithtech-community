namespace FaithTech.Community.Domain.Agile;

public class WorkspaceMember
{
    private WorkspaceMember() { }

    internal WorkspaceMember(Guid workspaceId, Guid profileId, DateTimeOffset addedAt)
    {
        WorkspaceId = workspaceId;
        ProfileId = profileId;
        AddedAt = addedAt;
    }

    public Guid WorkspaceId { get; private set; }

    public Guid ProfileId { get; private set; }

    public DateTimeOffset AddedAt { get; private set; }
}
