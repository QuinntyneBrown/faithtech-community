namespace FaithTech.Community.Application.Common;

/// <summary>
/// Writes CSV files for download: the attendance export (L2-122) and the Reports export (L2-128). The header is
/// the first row; a null cell is written empty.
/// </summary>
public interface ICsvWriter
{
    string Write(IEnumerable<IReadOnlyList<string?>> rows);
}

/// <summary>A CSV download: the file name and its text.</summary>
public record CsvFile(string FileName, string Content);
