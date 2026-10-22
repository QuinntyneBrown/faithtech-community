using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Writes a Stage moved timeline entry for every stage change recorded before the timeline
    /// existed (L2-110 AC7). The NOT EXISTS guard makes it safe to re-run. Partners have no
    /// creation time, so no Added entry is backfilled.
    /// </summary>
    public partial class PartnerStageMoveActivities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                INSERT INTO "PartnerActivities" ("Id", "PartnerId", "Kind", "Summary", "OccurredOn", "OccurredAt",
                    "LoggedById", "LoggedAtUtc", "FromStage", "ToStage", "StageChangeId")
                SELECT gen_random_uuid(), c."PartnerId", 'StageMoved', c."Note", (c."MovedAtUtc" AT TIME ZONE 'UTC')::date,
                    (c."MovedAtUtc" AT TIME ZONE 'UTC')::time, c."MovedBy", c."MovedAtUtc", c."From", c."To", c."Id"
                FROM "PartnerStageChanges" c
                WHERE NOT EXISTS (SELECT 1 FROM "PartnerActivities" a WHERE a."StageChangeId" = c."Id");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Backfilled rows cannot be told apart from moves the app recorded since; rolling back
            // PartnerActivities drops both with the table.
        }
    }
}
