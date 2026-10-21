using FaithTech.Community.Application.Identity;
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Infrastructure.Identity;

public class VerificationResend
{
    public long Id { get; set; }

    public string NormalizedEmail { get; set; } = string.Empty;

    public DateTimeOffset RequestedAt { get; set; }
}

public class VerificationResendLog(CommunityDbContext db) : IVerificationResendLog
{
    public Task<int> CountSinceAsync(string normalizedEmail, DateTimeOffset since, CancellationToken cancellationToken = default) =>
        db.VerificationResends.CountAsync(r => r.NormalizedEmail == normalizedEmail && r.RequestedAt > since, cancellationToken);

    public async Task RecordAsync(string normalizedEmail, DateTimeOffset at, CancellationToken cancellationToken = default)
    {
        db.VerificationResends.Add(new VerificationResend { NormalizedEmail = normalizedEmail, RequestedAt = at });
        await db.SaveChangesAsync(cancellationToken);
    }
}
