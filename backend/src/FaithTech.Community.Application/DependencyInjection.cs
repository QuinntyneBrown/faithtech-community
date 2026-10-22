using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Agile;
using FaithTech.Community.Application.Contacts;
using FaithTech.Community.Application.Events;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Application.Invites;
using FaithTech.Community.Application.Partners;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Application.Team;
using FluentValidation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace FaithTech.Community.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<Common.WebAppOptions>(configuration.GetSection(Common.WebAppOptions.Section));
        services.AddValidatorsFromAssemblyContaining<SignUpValidator>();
        services.AddScoped<VerificationEmails>();
        services.AddScoped<SignUpHandler>();
        services.AddScoped<ConfirmEmailHandler>();
        services.AddScoped<ResendVerificationHandler>();
        services.AddScoped<SignInHandler>();
        services.AddScoped<RequestPasswordResetHandler>();
        services.AddScoped<ResetPasswordHandler>();
        services.AddScoped<ProfileAccess>();
        services.AddScoped<GetProfileHandler>();
        services.AddScoped<ListPeopleHandler>();
        services.AddScoped<UpdateProfileHandler>();
        services.AddScoped<UploadPhotoHandler>();
        services.AddScoped<PhotoLeases>();
        services.AddScoped<PhotoAccess>();
        services.AddScoped<DescribePhotoHandler>();
        services.AddScoped<SetFeaturedPhotoHandler>();
        services.AddScoped<DeletePhotoHandler>();
        services.AddScoped<PhotoStorageRetryHandler>();
        services.AddScoped<GetAuditEntriesHandler>();
        services.AddScoped<RoleAssignmentPolicy>();
        services.AddScoped<RoleChangeNotifier>();
        services.AddScoped<ChangeRolesHandler>();
        services.AddScoped<SuspensionHandler>();
        services.AddScoped<SearchUsersHandler>();
        services.AddScoped<InviteSender>();
        services.AddScoped<ManageInvitesHandler>();
        services.AddScoped<AcceptInviteHandler>();
        services.AddScoped<ContactAccess>();
        services.AddScoped<ContactViews>();
        services.AddScoped<ManageContactsHandler>();
        services.AddScoped<ContactNotesHandler>();
        services.AddScoped<ArchiveContactsHandler>();
        services.AddScoped<ContactSignedUpHandler>();
        services.AddScoped<LinkContactHandler>();
        services.AddScoped<PartnerAccess>();
        services.AddScoped<PartnerViews>();
        services.AddScoped<ManagePartnersHandler>();
        services.AddScoped<MovePartnerHandler>();
        services.AddScoped<ListTeamHandler>();
        services.AddScoped<WorkspaceAccessPolicy>();
        services.AddScoped<AgileNotifier>();
        services.AddScoped<WorkspaceMembership>();
        services.AddScoped<WorkspacesHandler>();
        services.AddScoped<WorkspaceSettingsHandler>();
        services.AddScoped<WorkItemsHandler>();
        services.AddScoped<BoardHandler>();
        services.AddScoped<SprintsHandler>();
        services.AddScoped<ArchiveHandler>();
        services.AddScoped<CityLeadRoleRemovedHandler>();
        services.AddScoped<PlanningPokerHandler>();
        services.AddScoped<EventPermissions>();
        services.AddScoped<ListEventsHandler>();
        services.AddScoped<SaveEventHandler>();
        services.TryAddSingleton(TimeProvider.System);
        return services;
    }
}
