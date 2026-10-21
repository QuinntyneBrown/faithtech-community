namespace FaithTech.Community.Domain.Agile;

public static class WorkItemHierarchy
{
    public static bool CanParent(WorkItemKind parent, WorkItemKind child) =>
        (parent, child) is (WorkItemKind.Initiative, WorkItemKind.Epic)
            or (WorkItemKind.Epic, WorkItemKind.Story)
            or (WorkItemKind.Story, WorkItemKind.Task);
}
