using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace FaithTech.Community.Api.Tests.Fakes;

/// <summary>
/// Holds matching saves until a set number of them are waiting, then lets them all go at once, so a
/// test can make overlapping requests read before any of them writes. Passes every save through when
/// it is not armed.
/// </summary>
public class SaveChangesGate : SaveChangesInterceptor
{
    private readonly object _sync = new();
    private Func<DbContext, bool>? _match;
    private int _expected;
    private int _arrived;
    private TaskCompletionSource _open = new(TaskCreationOptions.RunContinuationsAsynchronously);

    /// <summary>Arms the gate: the next <paramref name="count"/> saves that match wait for one another.</summary>
    public void HoldUntil(int count, Func<DbContext, bool> match)
    {
        lock (_sync)
        {
            _match = match;
            _expected = count;
            _arrived = 0;
            _open = new(TaskCreationOptions.RunContinuationsAsynchronously);
        }
    }

    public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Task? wait = null;
        lock (_sync)
        {
            if (_match is not null && eventData.Context is { } context && _match(context))
            {
                if (++_arrived >= _expected)
                {
                    _match = null;
                    _open.TrySetResult();
                }

                wait = _open.Task;
            }
        }

        if (wait is not null)
        {
            // A save that never arrives must not hang the suite; the assertions report it.
            await Task.WhenAny(wait, Task.Delay(TimeSpan.FromSeconds(10), cancellationToken));
        }

        return result;
    }
}
