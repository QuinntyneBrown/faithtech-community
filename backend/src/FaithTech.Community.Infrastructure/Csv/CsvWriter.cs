using System.Text;
using FaithTech.Community.Application.Common;

namespace FaithTech.Community.Infrastructure.Csv;

/// <summary>
/// RFC 4180 CSV: CRLF line ends and every cell quoted, with inner quotes doubled. A cell starting with =, +, -, @,
/// a tab or a carriage return is prefixed with an apostrophe so spreadsheets do not run it as a formula (L2-097 AC3).
/// </summary>
public class CsvWriter : ICsvWriter
{
    private static readonly char[] FormulaStarts = ['=', '+', '-', '@', '\t', '\r'];

    public string Write(IEnumerable<IReadOnlyList<string?>> rows)
    {
        var csv = new StringBuilder();
        foreach (var row in rows)
        {
            csv.AppendJoin(',', row.Select(Cell)).Append("\r\n");
        }

        return csv.ToString();
    }

    private static string Cell(string? value)
    {
        value ??= string.Empty;
        if (value.Length > 0 && FormulaStarts.Contains(value[0]))
        {
            value = "'" + value;
        }

        return $"\"{value.Replace("\"", "\"\"", StringComparison.Ordinal)}\"";
    }
}
