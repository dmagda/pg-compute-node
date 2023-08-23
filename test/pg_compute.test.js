const { Client, Pool } = require("pg");
const { PostgreSqlContainer } = require("@testcontainers/postgresql");
const { PgCompute } = require("../compute/pg_compute");
const { DeploymentMode } = require("../compute/deployment");

describe("PgCompute Tests", () => {
    jest.setTimeout(60000);

    let pgContainer;
    let pgClient;
    let pgCompute;

    beforeAll(async () => {
        pgContainer = await new PostgreSqlContainer("sibedge/postgres-plv8").start();

        pgClient = new Client({ connectionString: pgContainer.getConnectionUri() });
        await pgClient.connect();
        await pgClient.query("create extension plv8");

        pgCompute = new PgCompute();
        await pgCompute.init(pgClient);
    });

    afterAll(async () => {
        await pgClient.end();
        await pgContainer.stop();
    });

    it("should run calculation logic", async () => {
        let result = await pgCompute.run(pgClient, plv8TestSum);
        expect(result).toBe(5);

        result = await pgClient.query("select * from pg_compute");
        expect(result.rows.length).toBe(1);

        let row = result.rows[0];

        expect(row.name).toMatch("plv8TestSum");
        expect(row.args).toMatch("");
        expect(row.body_hashcode.length).toBeGreaterThan(5);
    });

    it("should return pg version", async () => {
        let result = await pgCompute.run(pgClient, plv8GetPostgresVersion);

        expect(result[0].version).toContain("PostgreSQL");
        expect(result[0].plv8_version).toMatch(new RegExp('^([1-9]\d*|0)(\.(([1-9]\d*)|0)){2}$'));
    })
});

function plv8TestSum() {
    let a = 2;
    let b = 3;

    return a + b;
}

function plv8GetPostgresVersion() {
    let json_result = plv8.execute('SELECT version(), plv8_version()');
    return json_result;
}