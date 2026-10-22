using System.Collections.Concurrent;
using Serilog.Core;
using Serilog.Events;

namespace FaithTech.Community.Api.Tests.Fakes;

/// <summary>Keeps every log event the API emits, so tests can check what reaches the logs.</summary>
public class CapturingLogSink : ILogEventSink
{
    public ConcurrentQueue<LogEvent> Events { get; } = new();

    public void Emit(LogEvent logEvent) => Events.Enqueue(logEvent);

    /// <summary>Each event as its rendered message followed by every property, scope values included.</summary>
    public IEnumerable<string> Rendered() =>
        Events.Select(e => e.RenderMessage() + " " + string.Join(" ", e.Properties.Select(p => $"{p.Key}={p.Value}"))
            + (e.Exception is null ? string.Empty : " " + e.Exception));
}
