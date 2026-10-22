using System.Linq.Expressions;
using System.Text.RegularExpressions;
using FaithTech.Community.Application.Search;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Contacts;
using FaithTech.Community.Domain.Partners;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Fakes;

/// <summary>
/// Stands in for Postgres full-text search: every word of the term must start a word of the record's document, ignoring
/// case. The documents mirror the generated SearchVector columns (SearchVectors in Infrastructure).
/// </summary>
public partial class InMemoryFullTextSearch : IFullTextSearch
{
    private static readonly Dictionary<Type, LambdaExpression> Documents = new()
    {
        [typeof(Profile)] = Doc<Profile>(p => p.Name + " " + p.HomeCity + " " + p.Bio),
        [typeof(Contact)] = Doc<Contact>(c => c.Name + " " + c.Email + " " + c.Organization + " " + c.City),
        [typeof(Partner)] = Doc<Partner>(p => p.Name + " " + p.Offering + " " + p.ContactName + " " + p.Notes),
        [typeof(WorkItem)] = Doc<WorkItem>(i => i.Title + " " + i.Description),
    };

    public IQueryable<T> Match<T>(IQueryable<T> source, string term) where T : class
    {
        var document = (Expression<Func<T, string>>)Documents[typeof(T)];
        var words = Words().Matches(term.ToLowerInvariant()).Select(m => m.Value).ToList();
        if (words.Count == 0)
        {
            return source.Where(_ => false);
        }

        // " " + lower(document), so " word" finds a word at the start of the document too.
        var parameter = document.Parameters[0];
        var text = Expression.Call(
            typeof(string).GetMethod(nameof(string.Concat), [typeof(string), typeof(string)])!,
            Expression.Constant(" "),
            Expression.Call(document.Body, typeof(string).GetMethod(nameof(string.ToLowerInvariant), Type.EmptyTypes)!));
        var contains = typeof(string).GetMethod(nameof(string.Contains), [typeof(string)])!;
        var all = words
            .Select(w => (Expression)Expression.Call(text, contains, Expression.Constant(" " + w)))
            .Aggregate(Expression.AndAlso);
        return source.Where(Expression.Lambda<Func<T, bool>>(all, parameter));
    }

    private static Expression<Func<T, string>> Doc<T>(Expression<Func<T, string>> document) => document;

    [GeneratedRegex(@"[\p{L}\p{N}]+")]
    private static partial Regex Words();
}
