namespace FaithTech.Community.Application.Common;

/// <summary>
/// Writes CSV files for download: the attendance export (L2-097) and the Reports export (L2-103). The header is
/// the first row; a null cell is written empty.
/// </summary>
public interface ICsvWriter
{
    string Write(IEnumerable<IReadOnlyList<string?>> rows);
}
