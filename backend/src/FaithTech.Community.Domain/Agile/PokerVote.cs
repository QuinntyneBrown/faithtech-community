namespace FaithTech.Community.Domain.Agile;

public class PokerVote
{
    private PokerVote() { }

    internal PokerVote(Guid sessionId, Guid profileId, int round, DeckValue value)
    {
        SessionId = sessionId;
        ProfileId = profileId;
        Round = round;
        Value = value;
    }

    public Guid SessionId { get; private set; }

    public Guid ProfileId { get; private set; }

    public int Round { get; private set; }

    public DeckValue Value { get; private set; }

    internal void Change(DeckValue value) => Value = value;
}
