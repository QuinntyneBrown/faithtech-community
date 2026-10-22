using System.Linq.Expressions;
using FaithTech.Community.Application.Search;

namespace FaithTech.Community.Api.Tests.Fakes;

/// <summary>
/// Stands in for PostgreSQL full-text search, which the in-memory database cannot run: a record matches when its
/// document contains every word of the term, ignoring case. The permission filters on the source are the real ones.
/// </summary>
public class InMemoryFullTextSearch : IFullTextSearch
{
    private static readonly System.Reflection.MethodInfo Contains = typeof(string).GetMethod(nameof(string.Contains), [typeof(string)])!;
    private static readonly System.Reflection.MethodInfo ToLower = typeof(string).GetMethod(nameof(string.ToLower), Type.EmptyTypes)!;

    public IQueryable<T> Match<T>(IQueryable<T> source, string term, Expression<Func<T, string>> document) where T : class
    {
        var words = term.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var text = Expression.Call(document.Body, ToLower);
        var all = words
            .Select(w => (Expression)Expression.Call(text, Contains, Expression.Constant(w.ToLowerInvariant())))
            .Aggregate(Expression.AndAlso);
        return source.Where(Expression.Lambda<Func<T, bool>>(all, document.Parameters));
    }
}
