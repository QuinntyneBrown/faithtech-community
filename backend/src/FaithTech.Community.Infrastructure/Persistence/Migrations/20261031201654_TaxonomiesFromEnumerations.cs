using System;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TaxonomiesFromEnumerations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PartnerStages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganisationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsInitial = table.Column<bool>(type: "boolean", nullable: false),
                    Kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ArchivedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PartnerStages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PartnerStages_Organisations_OrganisationId",
                        column: x => x.OrganisationId,
                        principalTable: "Organisations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PartnerStages_OrganisationId",
                table: "PartnerStages",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_PartnerStages_OrganisationId_Key",
                table: "PartnerStages",
                columns: new[] { "OrganisationId", "Key" },
                unique: true);

            // Every organisation gets the stages the enumeration had (L2-151 AC3): FaithTech's with the seed's fixed ids,
            // any other with new ones.
            var order = 1;
            foreach (var stage in FaithTechSeed.Stages)
            {
                migrationBuilder.Sql($$"""
                    INSERT INTO "PartnerStages" ("Id", "OrganisationId", "Key", "Name", "SortOrder", "IsInitial", "Kind")
                    SELECT CASE WHEN o."Id" = '{{FaithTechSeed.OrganisationId}}' THEN '{{stage.Id}}'::uuid ELSE gen_random_uuid() END,
                           o."Id", '{{stage.Key}}', '{{stage.Name}}', {{order++}}, {{(stage.IsInitial ? "TRUE" : "FALSE")}}, '{{stage.Kind}}'
                    FROM "Organisations" o;
                    """);
            }

            // Partners point at their organisation's stage of the same former value.
            migrationBuilder.AddColumn<Guid>(
                name: "StageId",
                table: "Partners",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "Partners" p SET "StageId" = s."Id"
                FROM "PartnerStages" s
                WHERE s."OrganisationId" = p."OrganisationId"
                  AND s."Key" = CASE p."Stage" WHEN 'InFunnel' THEN 'in-funnel' WHEN 'Confirmed' THEN 'confirmed' ELSE 'lead' END;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "StageId",
                table: "Partners",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.DropIndex(
                name: "IX_Partners_Stage",
                table: "Partners");

            migrationBuilder.DropColumn(
                name: "Stage",
                table: "Partners");

            migrationBuilder.CreateIndex(
                name: "IX_Partners_StageId",
                table: "Partners",
                column: "StageId");

            migrationBuilder.AddForeignKey(
                name: "FK_Partners_PartnerStages_StageId",
                table: "Partners",
                column: "StageId",
                principalTable: "PartnerStages",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // History records keys from now on (L2-144 AC6).
            foreach (var (table, from, to) in new[] { ("PartnerStageChanges", "From", "To"), ("PartnerActivities", "FromStage", "ToStage") })
            {
                foreach (var column in new[] { from, to })
                {
                    migrationBuilder.AlterColumn<string>(
                        name: column,
                        table: table,
                        type: "character varying(40)",
                        maxLength: 40,
                        nullable: table == "PartnerActivities",
                        oldClrType: typeof(string),
                        oldType: "character varying(16)",
                        oldMaxLength: 16,
                        oldNullable: table == "PartnerActivities");
                    migrationBuilder.Sql($$"""
                        UPDATE "{{table}}" SET "{{column}}" = CASE "{{column}}" WHEN 'Lead' THEN 'lead' WHEN 'InFunnel' THEN 'in-funnel' WHEN 'Confirmed' THEN 'confirmed' ELSE "{{column}}" END
                        WHERE "{{column}}" IS NOT NULL;
                        """);
                }
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Partners_PartnerStages_StageId",
                table: "Partners");

            migrationBuilder.AddColumn<string>(
                name: "Stage",
                table: "Partners",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "Lead");

            migrationBuilder.Sql("""
                UPDATE "Partners" p SET "Stage" = CASE s."Key" WHEN 'in-funnel' THEN 'InFunnel' WHEN 'confirmed' THEN 'Confirmed' ELSE 'Lead' END
                FROM "PartnerStages" s WHERE s."Id" = p."StageId";
                UPDATE "PartnerStageChanges" SET "From" = CASE "From" WHEN 'in-funnel' THEN 'InFunnel' WHEN 'confirmed' THEN 'Confirmed' ELSE 'Lead' END,
                                                 "To" = CASE "To" WHEN 'in-funnel' THEN 'InFunnel' WHEN 'confirmed' THEN 'Confirmed' ELSE 'Lead' END;
                UPDATE "PartnerActivities" SET "FromStage" = CASE "FromStage" WHEN 'in-funnel' THEN 'InFunnel' WHEN 'confirmed' THEN 'Confirmed' ELSE 'Lead' END
                WHERE "FromStage" IS NOT NULL;
                UPDATE "PartnerActivities" SET "ToStage" = CASE "ToStage" WHEN 'in-funnel' THEN 'InFunnel' WHEN 'confirmed' THEN 'Confirmed' ELSE 'Lead' END
                WHERE "ToStage" IS NOT NULL;
                """);

            migrationBuilder.DropTable(
                name: "PartnerStages");

            migrationBuilder.DropIndex(
                name: "IX_Partners_StageId",
                table: "Partners");

            migrationBuilder.DropColumn(
                name: "StageId",
                table: "Partners");

            migrationBuilder.AlterColumn<string>(
                name: "To",
                table: "PartnerStageChanges",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(40)",
                oldMaxLength: 40);

            migrationBuilder.AlterColumn<string>(
                name: "From",
                table: "PartnerStageChanges",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(40)",
                oldMaxLength: 40);

            migrationBuilder.AlterColumn<string>(
                name: "ToStage",
                table: "PartnerActivities",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(40)",
                oldMaxLength: 40,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "FromStage",
                table: "PartnerActivities",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(40)",
                oldMaxLength: 40,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Partners_Stage",
                table: "Partners",
                column: "Stage");
        }
    }
}
