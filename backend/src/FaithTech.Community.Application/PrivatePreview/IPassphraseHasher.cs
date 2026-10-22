namespace FaithTech.Community.Application.PrivatePreview;

/// <summary>Salted, slow hashing of the owner's passphrase (L2-087 AC4, L2-090).</summary>
public interface IPassphraseHasher
{
    /// <summary>A new encoded hash of <paramref name="passphrase"/> with a fresh salt.</summary>
    string Hash(string passphrase);

    /// <summary>Whether <paramref name="passphrase"/> matches <paramref name="encodedHash"/>, compared in constant time.</summary>
    bool Verify(string passphrase, string encodedHash);

    /// <summary>Whether <paramref name="encodedHash"/> is a hash this hasher can check, at full strength.</summary>
    bool IsUsable(string encodedHash);
}
