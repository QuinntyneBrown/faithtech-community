namespace FaithTech.Community.Domain.Agile;

public class Sprint
{
    private Sprint() { }

    public Sprint(Guid workspaceId, string name, string goal, DateOnly startDate, DateOnly endDate)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(goal);
        if (endDate <= startDate)
        {
            throw new ArgumentException("A sprint must end after it starts.", nameof(endDate));
        }

        Id = Guid.NewGuid();
        WorkspaceId = workspaceId;
        Name = name;
        Goal = goal;
        StartDate = startDate;
        EndDate = endDate;
    }

    public Guid Id { get; private set; }

    public Guid WorkspaceId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string Goal { get; private set; } = string.Empty;

    public DateOnly StartDate { get; private set; }

    public DateOnly EndDate { get; private set; }

    public SprintState State { get; private set; }

    public int? CompletedPoints { get; private set; }

    /// <summary>The points of every story in the sprint when it closed, done or not ("completed N of M").</summary>
    public int? CommittedPoints { get; private set; }

    public void Close(IEnumerable<WorkItem> stories)
    {
        if (State == SprintState.Closed)
        {
            throw new InvalidOperationException("The sprint is already closed.");
        }

        var sprintStories = stories.Where(s => s.SprintId == Id).ToList();
        CompletedPoints = sprintStories.Where(s => s.Status == WorkItemStatus.Done).Sum(s => s.StoryPoints ?? 0);
        CommittedPoints = sprintStories.Sum(s => s.StoryPoints ?? 0);
        foreach (var story in sprintStories.Where(s => s.Status != WorkItemStatus.Done))
        {
            story.ReturnToBacklog();
        }

        State = SprintState.Closed;
    }

    internal void Start()
    {
        if (State != SprintState.Planned)
        {
            throw new InvalidOperationException("Only a planned sprint can start.");
        }

        State = SprintState.Active;
    }
}
