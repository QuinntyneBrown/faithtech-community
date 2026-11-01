using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OrganisationGiving : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GivingLink",
                table: "Organisations",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GivingText",
                table: "Organisations",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            // FaithTech's giving link, as the SoCal hub used it (L2-151 AC1, L2-158 AC4); an organisation that set its own keeps it.
            migrationBuilder.Sql(
                "UPDATE \"Organisations\" SET \"GivingLink\" = 'https://faithtech.com/donate', \"GivingText\" = 'Help us build the next one.' " +
                "WHERE \"Id\" = '0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b6c01' AND \"GivingLink\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GivingLink",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "GivingText",
                table: "Organisations");
        }
    }
}
