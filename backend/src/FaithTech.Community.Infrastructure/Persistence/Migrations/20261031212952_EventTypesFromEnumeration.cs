using System;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EventTypesFromEnumeration : Migration
    {
        /// <summary>The former enumeration names, in the order of <see cref="FaithTechSeed.Types"/>.</summary>
        private static readonly string[] FormerNames = ["Gathering", "BuildersNight", "Hackathon", "PrayerAndPlanning", "Panel"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EventTypes",
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
                    table.PrimaryKey("PK_EventTypes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventTypes_Organisations_OrganisationId",
                        column: x => x.OrganisationId,
                        principalTable: "Organisations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EventTypes_OrganisationId",
                table: "EventTypes",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_EventTypes_OrganisationId_Key",
                table: "EventTypes",
                columns: new[] { "OrganisationId", "Key" },
                unique: true);

            // Every organisation gets the types the enumeration had (L2-151 AC3): FaithTech's with the seed's fixed ids,
            // any other with new ones.
            var order = 1;
            foreach (var type in FaithTechSeed.Types)
            {
                migrationBuilder.Sql($$"""
                    INSERT INTO "EventTypes" ("Id", "OrganisationId", "Key", "Name", "SortOrder")
                    SELECT CASE WHEN o."Id" = '{{FaithTechSeed.OrganisationId}}' THEN '{{type.Id}}'::uuid ELSE gen_random_uuid() END,
                           o."Id", '{{type.Key}}', '{{type.Name}}', {{order++}}
                    FROM "Organisations" o;
                    """);
            }

            // Events point at their organisation's type of the same former value (L2-151 AC4).
            migrationBuilder.AddColumn<Guid>(
                name: "TypeId",
                table: "Events",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql($"""
                UPDATE "Events" e SET "TypeId" = t."Id"
                FROM "EventTypes" t
                WHERE t."OrganisationId" = e."OrganisationId"
                  AND t."Key" = CASE e."Type" {Cases(FormerNames, KeysInOrder())} ELSE 'gathering' END;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "TypeId",
                table: "Events",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.DropColumn(
                name: "Type",
                table: "Events");

            migrationBuilder.CreateIndex(
                name: "IX_Events_TypeId",
                table: "Events",
                column: "TypeId");

            migrationBuilder.AddForeignKey(
                name: "FK_Events_EventTypes_TypeId",
                table: "Events",
                column: "TypeId",
                principalTable: "EventTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Events_EventTypes_TypeId",
                table: "Events");

            migrationBuilder.AddColumn<string>(
                name: "Type",
                table: "Events",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Gathering");

            migrationBuilder.Sql($"""
                UPDATE "Events" e SET "Type" = CASE t."Key" {Cases(KeysInOrder(), FormerNames)} ELSE 'Gathering' END
                FROM "EventTypes" t WHERE t."Id" = e."TypeId";
                """);

            migrationBuilder.DropIndex(
                name: "IX_Events_TypeId",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "TypeId",
                table: "Events");

            migrationBuilder.DropTable(
                name: "EventTypes");
        }

        private static string[] KeysInOrder() => [.. FaithTechSeed.Types.Select(t => t.Key)];

        private static string Cases(string[] from, string[] to) =>
            string.Join(' ', from.Select((value, i) => $"WHEN '{value}' THEN '{to[i]}'"));
    }
}
