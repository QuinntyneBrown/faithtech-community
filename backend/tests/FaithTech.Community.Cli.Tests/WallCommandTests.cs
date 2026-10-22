// Traces to: L2-105 AC2, AC3
using FaithTech.Community.Infrastructure.PrivatePreview;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Cli.Tests;

public class WallCommandTests
{
    private const string Passphrase = "a long owner passphrase for the wall";

    [Fact]
    public async Task Wall_hash_prints_a_pbkdf2_hash_of_the_passphrase_read_from_standard_input()
    {
        var output = new StringWriter();

        var exit = await Run(new StringReader(Passphrase + "\n"), output, "wall-hash");

        Assert.Equal(0, exit);
        var hash = output.ToString().Trim();
        Assert.StartsWith("pbkdf2-sha256$600000$", hash);
        Assert.DoesNotContain(Passphrase, output.ToString());
        var hasher = new Pbkdf2PassphraseHasher();
        Assert.True(hasher.Verify(Passphrase, hash));
        Assert.False(hasher.Verify(Passphrase + "!", hash));
    }

    [Fact]
    public async Task Wall_hash_salts_every_hash()
    {
        var first = new StringWriter();
        var second = new StringWriter();

        await Run(new StringReader(Passphrase), first, "wall-hash");
        await Run(new StringReader(Passphrase), second, "wall-hash");

        Assert.NotEqual(first.ToString(), second.ToString());
    }

    [Theory]
    [InlineData("fifteen chars!!")]
    [InlineData("")]
    public async Task Wall_hash_refuses_a_passphrase_under_16_characters(string passphrase)
    {
        var output = new StringWriter();

        Assert.Equal(1, await Run(new StringReader(passphrase), output, "wall-hash"));
        Assert.Equal(string.Empty, output.ToString());
    }

    [Fact]
    public async Task Wall_key_prints_a_new_random_256_bit_key()
    {
        var first = new StringWriter();
        var second = new StringWriter();

        Assert.Equal(0, await Run(TextReader.Null, first, "wall-key"));
        await Run(TextReader.Null, second, "wall-key");

        Assert.Equal(32, Convert.FromBase64String(first.ToString().Trim()).Length);
        Assert.NotEqual(first.ToString(), second.ToString());
    }

    private static Task<int> Run(TextReader input, TextWriter output, params string[] args) =>
        CliApp.RunAsync(args, options => options.UseInMemoryDatabase(Guid.NewGuid().ToString()), "https://app.faithtech.test", input: input, output: output);
}
