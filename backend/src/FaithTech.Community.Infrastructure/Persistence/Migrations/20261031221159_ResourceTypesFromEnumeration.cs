using System;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ResourceTypesFromEnumeration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ResourceTypes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganisationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    ArchivedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResourceTypes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ResourceTypes_Organisations_OrganisationId",
                        column: x => x.OrganisationId,
                        principalTable: "Organisations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ResourceTypes_OrganisationId",
                table: "ResourceTypes",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_ResourceTypes_OrganisationId_Key",
                table: "ResourceTypes",
                columns: new[] { "OrganisationId", "Key" },
                unique: true);

            // Every organisation gets the types the enumeration had (L2-151 AC3): FaithTech's with the seed's fixed ids,
            // any other with new ones.
            var order = 1;
            foreach (var type in FaithTechSeed.ResourceKinds)
            {
                migrationBuilder.Sql($$"""
                    INSERT INTO "ResourceTypes" ("Id", "OrganisationId", "Key", "Name", "SortOrder")
                    SELECT CASE WHEN o."Id" = '{{FaithTechSeed.OrganisationId}}' THEN '{{type.Id}}'::uuid ELSE gen_random_uuid() END,
                           o."Id", '{{type.Key}}', '{{type.Name}}', {{order++}}
                    FROM "Organisations" o;
                    """);
            }

            // Resources point at their organisation's type of the same former value (L2-151 AC4).
            migrationBuilder.AddColumn<Guid>(
                name: "TypeId",
                table: "Resources",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql($"""
                UPDATE "Resources" r SET "TypeId" = t."Id"
                FROM "ResourceTypes" t
                WHERE t."OrganisationId" = r."OrganisationId"
                  AND t."Key" = CASE r."Type" {Cases(FormerValues(), Keys())} ELSE 'other' END;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "TypeId",
                table: "Resources",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.DropColumn(
                name: "Type",
                table: "Resources");

            migrationBuilder.CreateIndex(
                name: "IX_Resources_TypeId",
                table: "Resources",
                column: "TypeId");

            migrationBuilder.AddForeignKey(
                name: "FK_Resources_ResourceTypes_TypeId",
                table: "Resources",
                column: "TypeId",
                principalTable: "ResourceTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Resources_ResourceTypes_TypeId",
                table: "Resources");

            migrationBuilder.AddColumn<string>(
                name: "Type",
                table: "Resources",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "Other");

            migrationBuilder.Sql($"""
                UPDATE "Resources" r SET "Type" = CASE t."Key" {Cases(Keys(), FormerValues())} ELSE 'Other' END
                FROM "ResourceTypes" t WHERE t."Id" = r."TypeId";
                """);

            migrationBuilder.DropIndex(
                name: "IX_Resources_TypeId",
                table: "Resources");

            migrationBuilder.DropColumn(
                name: "TypeId",
                table: "Resources");

            migrationBuilder.DropTable(
                name: "ResourceTypes");
        }

        private static string[] Keys() => [.. FaithTechSeed.ResourceKinds.Select(t => t.Key)];

        private static string[] FormerValues() => [.. FaithTechSeed.ResourceKinds.Select(t => t.FormerValue)];

        private static string Cases(string[] from, string[] to) =>
            string.Join(' ', from.Select((value, i) => $"WHEN '{value}' THEN '{to[i]}'"));
    }
}
