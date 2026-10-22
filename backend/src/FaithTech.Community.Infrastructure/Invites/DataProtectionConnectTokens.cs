using FaithTech.Community.Application.Invites;
using Microsoft.AspNetCore.DataProtection;

namespace FaithTech.Community.Infrastructure.Invites;

/// <summary>Connect tokens encrypted with ASP.NET Data Protection under their own purpose (ADR 0021).</summary>
public class DataProtectionConnectTokens(IDataProtectionProvider provider) : IConnectTokenProtector
{
    private readonly IDataProtector _protector = provider.CreateProtector("FaithTech.Community.ConnectLink.v1");

    public string Protect(string token) => _protector.Protect(token);

    public string Unprotect(string protectedToken) => _protector.Unprotect(protectedToken);
}
