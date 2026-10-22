using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace FaithTech.Community.Api.Tests.Fakes;

/// <summary>
/// Fails the next save whose pending changes match, before anything is written, as a lost connection or a failed
/// constraint would. Passes every save through when it is not armed.
/// </summary>
public class SaveFailures : SaveChangesInterceptor
{
    private readonly object _sync = new();
    private Func<DbContext, bool>? _match;

    /// <summary>Arms the interceptor: the next save that matches throws and writes nothing.</summary>
    public void FailNext(Func<DbContext, bool> match)
    {
        lock (_sync)
        {
            _match = match;
        }
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        lock (_sync)
        {
            if (_match is not null && eventData.Context is { } context && _match(context))
            {
                _match = null;
                throw new DbUpdateException("The database went away during the save.");
            }
        }

        return ValueTask.FromResult(result);
    }
}
