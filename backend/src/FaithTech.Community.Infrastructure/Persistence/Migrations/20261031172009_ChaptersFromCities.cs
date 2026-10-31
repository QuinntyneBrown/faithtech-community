using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NpgsqlTypes;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ChaptersFromCities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ChapterId",
                table: "Profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ChapterId",
                table: "Events",
                type: "uuid",
                nullable: true);

            // L2-141 AC6, seed design step 6. In every organisation with chapters on (FaithTech: City / Cities), one
            // chapter per distinct trimmed, case-folded home city and event city that is not already an active
            // chapter, added after the existing ones in name order. Its name is the spelling most rows use, ties
            // going to the first in ordinal order. Rows whose value matches a chapter take it; the rest are set to none
            // and written to the audit log as "chapter.migration.unmatched" with their table, row and value, and raised
            // as notices in the Cli's migrate output. Every statement is safe to run again.
            migrationBuilder.Sql(
                """
                WITH vals AS (
                    SELECT p."OrganisationId", btrim(p."HomeCity") AS v FROM "Profiles" p WHERE btrim(coalesce(p."HomeCity", '')) <> ''
                    UNION ALL
                    SELECT e."OrganisationId", btrim(e."City") FROM "Events" e WHERE btrim(e."City") <> ''
                ), spellings AS (
                    SELECT vals."OrganisationId", upper(vals.v) AS norm, vals.v, count(*) AS n
                    FROM vals
                    JOIN "Organisations" o ON o."Id" = vals."OrganisationId" AND o."ChapterLabelSingular" IS NOT NULL
                    WHERE char_length(vals.v) <= 60
                    GROUP BY vals."OrganisationId", upper(vals.v), vals.v
                ), chosen AS (
                    SELECT DISTINCT ON (s."OrganisationId", s.norm) s."OrganisationId", s.norm, s.v
                    FROM spellings s
                    WHERE NOT EXISTS (
                        SELECT 1 FROM "Chapters" c
                        WHERE c."OrganisationId" = s."OrganisationId" AND c."NormalizedName" = s.norm AND c."ArchivedAtUtc" IS NULL)
                    ORDER BY s."OrganisationId", s.norm, s.n DESC, s.v COLLATE "C"
                )
                INSERT INTO "Chapters" ("Id", "OrganisationId", "Name", "NormalizedName", "SortOrder", "ArchivedAtUtc")
                SELECT gen_random_uuid(), c."OrganisationId", c.v, c.norm,
                    coalesce((SELECT max(x."SortOrder") + 1 FROM "Chapters" x WHERE x."OrganisationId" = c."OrganisationId"), 0)
                        + row_number() OVER (PARTITION BY c."OrganisationId" ORDER BY c.v COLLATE "C") - 1,
                    NULL
                FROM chosen c;

                UPDATE "Profiles" p SET "ChapterId" = c."Id"
                FROM "Chapters" c
                WHERE p."ChapterId" IS NULL AND c."OrganisationId" = p."OrganisationId" AND c."ArchivedAtUtc" IS NULL
                    AND c."NormalizedName" = upper(btrim(p."HomeCity"));

                UPDATE "Events" e SET "ChapterId" = c."Id"
                FROM "Chapters" c
                WHERE e."ChapterId" IS NULL AND c."OrganisationId" = e."OrganisationId" AND c."ArchivedAtUtc" IS NULL
                    AND c."NormalizedName" = upper(btrim(e."City"));

                INSERT INTO "AuditEntries" ("Id", "OrganisationId", "ActorId", "Action", "TargetType", "TargetId", "BeforeJson", "AfterJson", "OccurredAtUtc", "IpAddress")
                SELECT gen_random_uuid(), u."OrganisationId", '00000000-0000-0000-0000-000000000000', 'chapter.migration.unmatched',
                    u.t, u."Id"::text, json_build_object('City', u.v)::text, NULL, now(), ''
                FROM (
                    SELECT 'Profile' AS t, p."OrganisationId", p."Id", p."HomeCity" AS v FROM "Profiles" p
                    WHERE p."ChapterId" IS NULL AND btrim(coalesce(p."HomeCity", '')) <> ''
                    UNION ALL
                    SELECT 'Event', e."OrganisationId", e."Id", e."City" FROM "Events" e
                    WHERE e."ChapterId" IS NULL AND btrim(e."City") <> ''
                ) u;

                DO $$
                DECLARE r record;
                BEGIN
                    FOR r IN SELECT a."TargetType", a."TargetId", a."BeforeJson" FROM "AuditEntries" a WHERE a."Action" = 'chapter.migration.unmatched'
                    LOOP
                        RAISE NOTICE 'ChaptersFromCities: % % had %, which matches no chapter; it now has none.', r."TargetType", r."TargetId", r."BeforeJson";
                    END LOOP;
                END $$;
                """);

            migrationBuilder.AlterColumn<NpgsqlTsVector>(
                name: "SearchVector",
                table: "Profiles",
                type: "tsvector",
                nullable: true,
                computedColumnSql: "to_tsvector('english', coalesce(\"Name\", '') || ' ' || coalesce(\"Bio\", ''))",
                stored: true,
                oldClrType: typeof(NpgsqlTsVector),
                oldType: "tsvector",
                oldNullable: true,
                oldComputedColumnSql: "to_tsvector('english', coalesce(\"Name\", '') || ' ' || coalesce(\"HomeCity\", '') || ' ' || coalesce(\"Bio\", ''))",
                oldStored: true);

            migrationBuilder.AlterColumn<NpgsqlTsVector>(
                name: "SearchVector",
                table: "Events",
                type: "tsvector",
                nullable: true,
                computedColumnSql: "to_tsvector('english', coalesce(\"Title\", '') || ' ' || coalesce(\"Description\", '') || ' ' || coalesce(\"Venue\", ''))",
                stored: true,
                oldClrType: typeof(NpgsqlTsVector),
                oldType: "tsvector",
                oldNullable: true,
                oldComputedColumnSql: "to_tsvector('english', coalesce(\"Title\", '') || ' ' || coalesce(\"Description\", '') || ' ' || coalesce(\"City\", '') || ' ' || coalesce(\"Venue\", ''))",
                oldStored: true);

            migrationBuilder.DropIndex(
                name: "IX_Profiles_HomeCity",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "HomeCity",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "City",
                table: "Events");

            migrationBuilder.CreateIndex(
                name: "IX_Profiles_ChapterId",
                table: "Profiles",
                column: "ChapterId");

            migrationBuilder.CreateIndex(
                name: "IX_Events_ChapterId",
                table: "Events",
                column: "ChapterId");

            migrationBuilder.AddForeignKey(
                name: "FK_Events_Chapters_ChapterId",
                table: "Events",
                column: "ChapterId",
                principalTable: "Chapters",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Profiles_Chapters_ChapterId",
                table: "Profiles",
                column: "ChapterId",
                principalTable: "Chapters",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Events_Chapters_ChapterId",
                table: "Events");

            migrationBuilder.DropForeignKey(
                name: "FK_Profiles_Chapters_ChapterId",
                table: "Profiles");

            migrationBuilder.DropIndex(
                name: "IX_Profiles_ChapterId",
                table: "Profiles");

            migrationBuilder.DropIndex(
                name: "IX_Events_ChapterId",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "ChapterId",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "ChapterId",
                table: "Events");

            migrationBuilder.AddColumn<string>(
                name: "HomeCity",
                table: "Profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "Events",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<NpgsqlTsVector>(
                name: "SearchVector",
                table: "Profiles",
                type: "tsvector",
                nullable: true,
                computedColumnSql: "to_tsvector('english', coalesce(\"Name\", '') || ' ' || coalesce(\"HomeCity\", '') || ' ' || coalesce(\"Bio\", ''))",
                stored: true,
                oldClrType: typeof(NpgsqlTsVector),
                oldType: "tsvector",
                oldNullable: true,
                oldComputedColumnSql: "to_tsvector('english', coalesce(\"Name\", '') || ' ' || coalesce(\"Bio\", ''))",
                oldStored: true);

            migrationBuilder.AlterColumn<NpgsqlTsVector>(
                name: "SearchVector",
                table: "Events",
                type: "tsvector",
                nullable: true,
                computedColumnSql: "to_tsvector('english', coalesce(\"Title\", '') || ' ' || coalesce(\"Description\", '') || ' ' || coalesce(\"City\", '') || ' ' || coalesce(\"Venue\", ''))",
                stored: true,
                oldClrType: typeof(NpgsqlTsVector),
                oldType: "tsvector",
                oldNullable: true,
                oldComputedColumnSql: "to_tsvector('english', coalesce(\"Title\", '') || ' ' || coalesce(\"Description\", '') || ' ' || coalesce(\"Venue\", ''))",
                oldStored: true);

            migrationBuilder.CreateIndex(
                name: "IX_Profiles_HomeCity",
                table: "Profiles",
                column: "HomeCity");
        }
    }
}
