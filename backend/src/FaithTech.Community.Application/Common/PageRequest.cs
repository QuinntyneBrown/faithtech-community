namespace FaithTech.Community.Application.Common;

public record PageRequest(int Page = 1, int PageSize = 25)
{
    public const int MaxPageSize = 100;

    public int Page { get; } = Math.Max(1, Page);

    public int PageSize { get; } = Math.Clamp(PageSize, 1, MaxPageSize);

    public int Skip => (Page - 1) * PageSize;
}
