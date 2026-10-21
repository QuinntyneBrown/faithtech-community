namespace FaithTech.Community.Domain.Identity;

public record EmailVerified
{
    public EmailVerified(Guid profileId, string email)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(email);
        ProfileId = profileId;
        Email = email;
    }

    public Guid ProfileId { get; }

    public string Email { get; }
}
