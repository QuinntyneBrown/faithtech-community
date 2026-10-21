namespace FaithTech.Community.Infrastructure.Email;

public class SmtpOptions
{
    public const string Section = "Smtp";

    public string Host { get; set; } = "localhost";

    public int Port { get; set; } = 1025;

    public bool UseTls { get; set; }

    public string? UserName { get; set; }

    public string? Password { get; set; }

    public string From { get; set; } = "FaithTech Community <no-reply@faithtech.community>";
}
