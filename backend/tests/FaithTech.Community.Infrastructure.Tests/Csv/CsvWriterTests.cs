// Traces to: L2-122 AC3, L2-128 AC3 (docs/detailed-designs/events/event-check-in)
using FaithTech.Community.Infrastructure.Csv;

namespace FaithTech.Community.Infrastructure.Tests.Csv;

public class CsvWriterTests
{
    private readonly CsvWriter _writer = new();

    private string Write(params IReadOnlyList<string?>[] rows) => _writer.Write(rows);

    // RFC 4180: CRLF line ends, the header first; every cell is quoted so no value can change the columns.
    [Fact]
    public void Writes_the_header_then_each_row_with_every_cell_quoted_and_crlf_line_ends()
    {
        var csv = Write(["Name", "Type"], ["Ruth Alvarez", "Member"], ["Abby Brooks", "Guest"]);

        Assert.Equal("\"Name\",\"Type\"\r\n\"Ruth Alvarez\",\"Member\"\r\n\"Abby Brooks\",\"Guest\"\r\n", csv);
    }

    [Fact]
    public void Doubles_inner_quotes_and_keeps_commas_and_line_breaks_inside_the_cell()
    {
        var csv = Write(["Abby \"AB\" Brooks", "Kestrel, Labs", "two\nlines"]);

        Assert.Equal("\"Abby \"\"AB\"\" Brooks\",\"Kestrel, Labs\",\"two\nlines\"\r\n", csv);
    }

    [Fact]
    public void Writes_a_null_cell_as_an_empty_one()
    {
        Assert.Equal("\"Ruth Alvarez\",\"\",\"\"\r\n", Write(["Ruth Alvarez", null, string.Empty]));
    }

    // L2-122 AC3: a cell that a spreadsheet would run as a formula is prefixed with an apostrophe.
    [Theory]
    [InlineData("=HYPERLINK(\"x\")", "'=HYPERLINK(\"\"x\"\")")]
    [InlineData("+1 555", "'+1 555")]
    [InlineData("-2+3", "'-2+3")]
    [InlineData("@SUM(A1)", "'@SUM(A1)")]
    [InlineData("\tcmd", "'\tcmd")]
    [InlineData("\rcmd", "'\rcmd")]
    public void Guards_cells_that_start_like_a_formula(string value, string written)
    {
        Assert.Equal($"\"{written}\"\r\n", Write([value]));
    }

    [Fact]
    public void Leaves_a_formula_character_inside_a_cell_alone()
    {
        Assert.Equal("\"a=b\",\"x-y\"\r\n", Write(["a=b", "x-y"]));
    }

    [Fact]
    public void Writes_nothing_for_no_rows()
    {
        Assert.Equal(string.Empty, _writer.Write([]));
    }
}
