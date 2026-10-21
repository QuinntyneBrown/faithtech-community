namespace FaithTech.Community.Domain.Agile;

public class Comment
{
    private Comment() { }

    internal Comment(Guid workItemId, Guid authorId, string body, DateTimeOffset createdAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(body);
        Id = Guid.NewGuid();
        WorkItemId = workItemId;
        AuthorId = authorId;
        Body = body;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }

    public Guid WorkItemId { get; private set; }

    public Guid AuthorId { get; private set; }

    public string Body { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; private set; }
}
