using System;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ScopeEveryRecord : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PendingConnections_ProfileId_LeadId",
                table: "PendingConnections");

            migrationBuilder.DropIndex(
                name: "IX_PartnerDuplicateDismissals_LowerPartnerId_HigherPartnerId",
                table: "PartnerDuplicateDismissals");

            migrationBuilder.DropIndex(
                name: "IX_Invites_TokenHash",
                table: "Invites");

            migrationBuilder.DropIndex(
                name: "IX_ConnectLinks_OwnerId",
                table: "ConnectLinks");

            migrationBuilder.DropIndex(
                name: "IX_ConnectLinks_TokenHash",
                table: "ConnectLinks");

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "Workspaces",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "WorkItems",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "Sprints",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "Resources",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "ResourceBlobTasks",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "Profiles",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "PokerSessions",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "PhotoBlobTasks",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "PendingConnections",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "PartnerStageChanges",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "Partners",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "PartnerDuplicateDismissals",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "PartnerActivities",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "OutboxMessages",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "Notifications",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "NotePages",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "NoteLinks",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "NoteImages",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "Invites",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "Events",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "Contacts",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "ContactNotes",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "ConnectLinks",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "AuditEntries",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganisationId",
                table: "Announcements",
                type: "uuid",
                nullable: false,
                defaultValue: FaithTechSeed.OrganisationId);

            migrationBuilder.CreateIndex(
                name: "IX_Workspaces_OrganisationId",
                table: "Workspaces",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkItems_OrganisationId",
                table: "WorkItems",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_Sprints_OrganisationId",
                table: "Sprints",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_Resources_OrganisationId",
                table: "Resources",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_ResourceBlobTasks_OrganisationId",
                table: "ResourceBlobTasks",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_Profiles_OrganisationId",
                table: "Profiles",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_PokerSessions_OrganisationId",
                table: "PokerSessions",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_PhotoBlobTasks_OrganisationId",
                table: "PhotoBlobTasks",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_PendingConnections_OrganisationId",
                table: "PendingConnections",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_PendingConnections_OrganisationId_ProfileId_LeadId",
                table: "PendingConnections",
                columns: new[] { "OrganisationId", "ProfileId", "LeadId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PartnerStageChanges_OrganisationId",
                table: "PartnerStageChanges",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_Partners_OrganisationId",
                table: "Partners",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_PartnerDuplicateDismissals_LowerPartnerId",
                table: "PartnerDuplicateDismissals",
                column: "LowerPartnerId");

            migrationBuilder.CreateIndex(
                name: "IX_PartnerDuplicateDismissals_OrganisationId",
                table: "PartnerDuplicateDismissals",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_PartnerDuplicateDismissals_OrganisationId_LowerPartnerId_Hi~",
                table: "PartnerDuplicateDismissals",
                columns: new[] { "OrganisationId", "LowerPartnerId", "HigherPartnerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PartnerActivities_OrganisationId",
                table: "PartnerActivities",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_OutboxMessages_OrganisationId",
                table: "OutboxMessages",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_OrganisationId",
                table: "Notifications",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_NotePages_OrganisationId",
                table: "NotePages",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_NoteLinks_OrganisationId",
                table: "NoteLinks",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_NoteImages_OrganisationId",
                table: "NoteImages",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_Invites_OrganisationId",
                table: "Invites",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_Invites_OrganisationId_TokenHash",
                table: "Invites",
                columns: new[] { "OrganisationId", "TokenHash" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Events_OrganisationId",
                table: "Events",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_Contacts_OrganisationId",
                table: "Contacts",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_ContactNotes_OrganisationId",
                table: "ContactNotes",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_ConnectLinks_OrganisationId",
                table: "ConnectLinks",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_ConnectLinks_OrganisationId_OwnerId",
                table: "ConnectLinks",
                columns: new[] { "OrganisationId", "OwnerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ConnectLinks_OrganisationId_TokenHash",
                table: "ConnectLinks",
                columns: new[] { "OrganisationId", "TokenHash" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AuditEntries_OrganisationId",
                table: "AuditEntries",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_Announcements_OrganisationId",
                table: "Announcements",
                column: "OrganisationId");

            migrationBuilder.AddForeignKey(
                name: "FK_Announcements_Organisations_OrganisationId",
                table: "Announcements",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_AuditEntries_Organisations_OrganisationId",
                table: "AuditEntries",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ConnectLinks_Organisations_OrganisationId",
                table: "ConnectLinks",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ContactNotes_Organisations_OrganisationId",
                table: "ContactNotes",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Contacts_Organisations_OrganisationId",
                table: "Contacts",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Events_Organisations_OrganisationId",
                table: "Events",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Invites_Organisations_OrganisationId",
                table: "Invites",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_NoteImages_Organisations_OrganisationId",
                table: "NoteImages",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_NoteLinks_Organisations_OrganisationId",
                table: "NoteLinks",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_NotePages_Organisations_OrganisationId",
                table: "NotePages",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Organisations_OrganisationId",
                table: "Notifications",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_OutboxMessages_Organisations_OrganisationId",
                table: "OutboxMessages",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PartnerActivities_Organisations_OrganisationId",
                table: "PartnerActivities",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PartnerDuplicateDismissals_Organisations_OrganisationId",
                table: "PartnerDuplicateDismissals",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Partners_Organisations_OrganisationId",
                table: "Partners",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PartnerStageChanges_Organisations_OrganisationId",
                table: "PartnerStageChanges",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PendingConnections_Organisations_OrganisationId",
                table: "PendingConnections",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PhotoBlobTasks_Organisations_OrganisationId",
                table: "PhotoBlobTasks",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PokerSessions_Organisations_OrganisationId",
                table: "PokerSessions",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Profiles_Organisations_OrganisationId",
                table: "Profiles",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ResourceBlobTasks_Organisations_OrganisationId",
                table: "ResourceBlobTasks",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Resources_Organisations_OrganisationId",
                table: "Resources",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Sprints_Organisations_OrganisationId",
                table: "Sprints",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkItems_Organisations_OrganisationId",
                table: "WorkItems",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Workspaces_Organisations_OrganisationId",
                table: "Workspaces",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Every existing row is FaithTech's (L2-151 AC4); from here on the context stamps each new row.
            migrationBuilder.Sql("ALTER TABLE \"Workspaces\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"WorkItems\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"Sprints\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"Resources\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"ResourceBlobTasks\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"Profiles\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"PokerSessions\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"PhotoBlobTasks\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"PendingConnections\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"PartnerStageChanges\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"Partners\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"PartnerDuplicateDismissals\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"PartnerActivities\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"OutboxMessages\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"Notifications\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"NotePages\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"NoteLinks\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"NoteImages\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"Invites\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"Events\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"Contacts\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"ContactNotes\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"ConnectLinks\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"AuditEntries\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
            migrationBuilder.Sql("ALTER TABLE \"Announcements\" ALTER COLUMN \"OrganisationId\" DROP DEFAULT;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Announcements_Organisations_OrganisationId",
                table: "Announcements");

            migrationBuilder.DropForeignKey(
                name: "FK_AuditEntries_Organisations_OrganisationId",
                table: "AuditEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_ConnectLinks_Organisations_OrganisationId",
                table: "ConnectLinks");

            migrationBuilder.DropForeignKey(
                name: "FK_ContactNotes_Organisations_OrganisationId",
                table: "ContactNotes");

            migrationBuilder.DropForeignKey(
                name: "FK_Contacts_Organisations_OrganisationId",
                table: "Contacts");

            migrationBuilder.DropForeignKey(
                name: "FK_Events_Organisations_OrganisationId",
                table: "Events");

            migrationBuilder.DropForeignKey(
                name: "FK_Invites_Organisations_OrganisationId",
                table: "Invites");

            migrationBuilder.DropForeignKey(
                name: "FK_NoteImages_Organisations_OrganisationId",
                table: "NoteImages");

            migrationBuilder.DropForeignKey(
                name: "FK_NoteLinks_Organisations_OrganisationId",
                table: "NoteLinks");

            migrationBuilder.DropForeignKey(
                name: "FK_NotePages_Organisations_OrganisationId",
                table: "NotePages");

            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Organisations_OrganisationId",
                table: "Notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_OutboxMessages_Organisations_OrganisationId",
                table: "OutboxMessages");

            migrationBuilder.DropForeignKey(
                name: "FK_PartnerActivities_Organisations_OrganisationId",
                table: "PartnerActivities");

            migrationBuilder.DropForeignKey(
                name: "FK_PartnerDuplicateDismissals_Organisations_OrganisationId",
                table: "PartnerDuplicateDismissals");

            migrationBuilder.DropForeignKey(
                name: "FK_Partners_Organisations_OrganisationId",
                table: "Partners");

            migrationBuilder.DropForeignKey(
                name: "FK_PartnerStageChanges_Organisations_OrganisationId",
                table: "PartnerStageChanges");

            migrationBuilder.DropForeignKey(
                name: "FK_PendingConnections_Organisations_OrganisationId",
                table: "PendingConnections");

            migrationBuilder.DropForeignKey(
                name: "FK_PhotoBlobTasks_Organisations_OrganisationId",
                table: "PhotoBlobTasks");

            migrationBuilder.DropForeignKey(
                name: "FK_PokerSessions_Organisations_OrganisationId",
                table: "PokerSessions");

            migrationBuilder.DropForeignKey(
                name: "FK_Profiles_Organisations_OrganisationId",
                table: "Profiles");

            migrationBuilder.DropForeignKey(
                name: "FK_ResourceBlobTasks_Organisations_OrganisationId",
                table: "ResourceBlobTasks");

            migrationBuilder.DropForeignKey(
                name: "FK_Resources_Organisations_OrganisationId",
                table: "Resources");

            migrationBuilder.DropForeignKey(
                name: "FK_Sprints_Organisations_OrganisationId",
                table: "Sprints");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkItems_Organisations_OrganisationId",
                table: "WorkItems");

            migrationBuilder.DropForeignKey(
                name: "FK_Workspaces_Organisations_OrganisationId",
                table: "Workspaces");

            migrationBuilder.DropIndex(
                name: "IX_Workspaces_OrganisationId",
                table: "Workspaces");

            migrationBuilder.DropIndex(
                name: "IX_WorkItems_OrganisationId",
                table: "WorkItems");

            migrationBuilder.DropIndex(
                name: "IX_Sprints_OrganisationId",
                table: "Sprints");

            migrationBuilder.DropIndex(
                name: "IX_Resources_OrganisationId",
                table: "Resources");

            migrationBuilder.DropIndex(
                name: "IX_ResourceBlobTasks_OrganisationId",
                table: "ResourceBlobTasks");

            migrationBuilder.DropIndex(
                name: "IX_Profiles_OrganisationId",
                table: "Profiles");

            migrationBuilder.DropIndex(
                name: "IX_PokerSessions_OrganisationId",
                table: "PokerSessions");

            migrationBuilder.DropIndex(
                name: "IX_PhotoBlobTasks_OrganisationId",
                table: "PhotoBlobTasks");

            migrationBuilder.DropIndex(
                name: "IX_PendingConnections_OrganisationId",
                table: "PendingConnections");

            migrationBuilder.DropIndex(
                name: "IX_PendingConnections_OrganisationId_ProfileId_LeadId",
                table: "PendingConnections");

            migrationBuilder.DropIndex(
                name: "IX_PartnerStageChanges_OrganisationId",
                table: "PartnerStageChanges");

            migrationBuilder.DropIndex(
                name: "IX_Partners_OrganisationId",
                table: "Partners");

            migrationBuilder.DropIndex(
                name: "IX_PartnerDuplicateDismissals_LowerPartnerId",
                table: "PartnerDuplicateDismissals");

            migrationBuilder.DropIndex(
                name: "IX_PartnerDuplicateDismissals_OrganisationId",
                table: "PartnerDuplicateDismissals");

            migrationBuilder.DropIndex(
                name: "IX_PartnerDuplicateDismissals_OrganisationId_LowerPartnerId_Hi~",
                table: "PartnerDuplicateDismissals");

            migrationBuilder.DropIndex(
                name: "IX_PartnerActivities_OrganisationId",
                table: "PartnerActivities");

            migrationBuilder.DropIndex(
                name: "IX_OutboxMessages_OrganisationId",
                table: "OutboxMessages");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_OrganisationId",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_NotePages_OrganisationId",
                table: "NotePages");

            migrationBuilder.DropIndex(
                name: "IX_NoteLinks_OrganisationId",
                table: "NoteLinks");

            migrationBuilder.DropIndex(
                name: "IX_NoteImages_OrganisationId",
                table: "NoteImages");

            migrationBuilder.DropIndex(
                name: "IX_Invites_OrganisationId",
                table: "Invites");

            migrationBuilder.DropIndex(
                name: "IX_Invites_OrganisationId_TokenHash",
                table: "Invites");

            migrationBuilder.DropIndex(
                name: "IX_Events_OrganisationId",
                table: "Events");

            migrationBuilder.DropIndex(
                name: "IX_Contacts_OrganisationId",
                table: "Contacts");

            migrationBuilder.DropIndex(
                name: "IX_ContactNotes_OrganisationId",
                table: "ContactNotes");

            migrationBuilder.DropIndex(
                name: "IX_ConnectLinks_OrganisationId",
                table: "ConnectLinks");

            migrationBuilder.DropIndex(
                name: "IX_ConnectLinks_OrganisationId_OwnerId",
                table: "ConnectLinks");

            migrationBuilder.DropIndex(
                name: "IX_ConnectLinks_OrganisationId_TokenHash",
                table: "ConnectLinks");

            migrationBuilder.DropIndex(
                name: "IX_AuditEntries_OrganisationId",
                table: "AuditEntries");

            migrationBuilder.DropIndex(
                name: "IX_Announcements_OrganisationId",
                table: "Announcements");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "Workspaces");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "WorkItems");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "Sprints");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "Resources");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "ResourceBlobTasks");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "PokerSessions");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "PhotoBlobTasks");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "PendingConnections");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "PartnerStageChanges");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "Partners");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "PartnerDuplicateDismissals");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "PartnerActivities");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "OutboxMessages");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "NotePages");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "NoteLinks");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "NoteImages");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "Invites");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "Contacts");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "ContactNotes");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "ConnectLinks");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "AuditEntries");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "Announcements");

            migrationBuilder.CreateIndex(
                name: "IX_PendingConnections_ProfileId_LeadId",
                table: "PendingConnections",
                columns: new[] { "ProfileId", "LeadId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PartnerDuplicateDismissals_LowerPartnerId_HigherPartnerId",
                table: "PartnerDuplicateDismissals",
                columns: new[] { "LowerPartnerId", "HigherPartnerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Invites_TokenHash",
                table: "Invites",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ConnectLinks_OwnerId",
                table: "ConnectLinks",
                column: "OwnerId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ConnectLinks_TokenHash",
                table: "ConnectLinks",
                column: "TokenHash",
                unique: true);
        }
    }
}
