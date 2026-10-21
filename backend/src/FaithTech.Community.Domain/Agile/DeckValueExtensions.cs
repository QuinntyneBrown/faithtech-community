namespace FaithTech.Community.Domain.Agile;

public static class DeckValueExtensions
{
    public static int? Points(this DeckValue value) => value == DeckValue.Unknown ? null : (int)value;
}
