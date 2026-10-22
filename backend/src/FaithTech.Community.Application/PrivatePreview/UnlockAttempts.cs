namespace FaithTech.Community.Application.PrivatePreview;

/// <summary>
/// Brute-force protection for the wall (L2-103). Five refusals from one address within 15 minutes pause that address
/// for 1 minute, then 2, 4, 8… up to 60; a hundred refusals from everywhere pause everyone for 15 minutes, doubling up
/// to 4 hours. A success, or 24 hours without a refusal, starts an address over. The state is in memory, so the API
/// runs as one replica while the wall is on (ADR 0026).
/// </summary>
public class UnlockAttempts(TimeProvider time)
{
    public const int MaxTrackedAddresses = 10_000;

    private static readonly Policy PerAddress = new(5, TimeSpan.FromMinutes(15), TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(60));
    private static readonly Policy Everyone = new(100, TimeSpan.FromMinutes(15), TimeSpan.FromMinutes(15), TimeSpan.FromHours(4));
    private static readonly TimeSpan Quiet = TimeSpan.FromHours(24);

    private readonly Dictionary<string, Record> _addresses = [];
    private readonly Record _everyone = new();
    private readonly Lock _gate = new();

    public bool IsLockedOut(string address)
    {
        var now = time.GetUtcNow();
        lock (_gate)
        {
            return now < _everyone.LockedUntil || (_addresses.TryGetValue(address, out var record) && now < record.LockedUntil);
        }
    }

    /// <summary>Counts a refusal and returns the address's refusals in the current window.</summary>
    public int RecordFailure(string address)
    {
        var now = time.GetUtcNow();
        lock (_gate)
        {
            if (!_addresses.TryGetValue(address, out var record))
            {
                Prune(now);
                _addresses[address] = record = new Record();
            }

            Register(_everyone, Everyone, now);
            return Register(record, PerAddress, now);
        }
    }

    public void RecordSuccess(string address)
    {
        lock (_gate)
        {
            _addresses.Remove(address);
        }
    }

    private static int Register(Record record, Policy policy, DateTimeOffset now)
    {
        if (now - record.LastFailure > Quiet)
        {
            record.Lockouts = 0;
        }

        while (record.Failures.TryPeek(out var oldest) && now - oldest > policy.Window)
        {
            record.Failures.Dequeue();
        }

        record.Failures.Enqueue(now);
        record.LastFailure = now;
        var count = record.Failures.Count;
        if (count >= policy.MaxFailures)
        {
            var pause = policy.FirstLockout * Math.Pow(2, Math.Min(record.Lockouts, 20));
            record.LockedUntil = now + (pause < policy.MaxLockout ? pause : policy.MaxLockout);
            record.Lockouts++;
            record.Failures.Clear();
        }

        return count;
    }

    // Keeps memory bounded: forget addresses that are quiet and not paused, then the oldest if still too many.
    private void Prune(DateTimeOffset now)
    {
        if (_addresses.Count < MaxTrackedAddresses)
        {
            return;
        }

        foreach (var (address, _) in _addresses.Where(a => a.Value.LockedUntil <= now && now - a.Value.LastFailure > PerAddress.Window).ToList())
        {
            _addresses.Remove(address);
        }

        foreach (var (address, _) in _addresses.OrderBy(a => a.Value.LastFailure).Take(_addresses.Count - MaxTrackedAddresses + 1).ToList())
        {
            _addresses.Remove(address);
        }
    }

    private sealed record Policy(int MaxFailures, TimeSpan Window, TimeSpan FirstLockout, TimeSpan MaxLockout);

    private sealed class Record
    {
        public Queue<DateTimeOffset> Failures { get; } = new();

        public DateTimeOffset LastFailure { get; set; } = DateTimeOffset.MinValue;

        public DateTimeOffset LockedUntil { get; set; } = DateTimeOffset.MinValue;

        public int Lockouts { get; set; }
    }
}
