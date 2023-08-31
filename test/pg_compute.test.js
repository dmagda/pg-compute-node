/**
 * Copyright 2023 Denis Magda
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *    http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { Client, Pool } = require("pg");
const { PostgreSqlContainer } = require("@testcontainers/postgresql");
const { PgCompute } = require("../compute/pg_compute");
const { DeploymentMode } = require("../compute/deployment");

describe("PgCompute Tests", () => {
    jest.setTimeout(60000);

    let pgContainer;
    let pgClient;
    let pgPool;

    beforeAll(async () => {
        pgContainer = await new PostgreSqlContainer("sibedge/postgres-plv8").start();

        pgClient = new Client({ connectionString: pgContainer.getConnectionUri() });
        await pgClient.connect();
        await pgClient.query("create extension plv8");

        pgPool = new Pool({ connectionString: pgContainer.getConnectionUri() });
    });

    afterAll(async () => {
        await pgClient.end();
        await pgPool.end();
        await pgContainer.stop();
    });

    it("should run calculation logic", async () => {
        let pgCompute = new PgCompute();
        await pgCompute.init(pgClient);

        let result = await pgCompute.run(pgClient, plv8TestSum);
        expect(result).toBe(5);

        result = await checkFunctionDeployed(pgClient, plv8TestSum);
        expect(result.rows[0].args).toMatch("");
    });

    it("should return pg version", async () => {
        let pgCompute = new PgCompute();
        await pgCompute.init(pgClient);

        let result = await pgCompute.run(pgClient, plv8GetPostgresVersion);

        expect(result[0].version).toContain("PostgreSQL");
        expect(result[0].plv8_version).toMatch(new RegExp('^([1-9]\d*|0)(\.(([1-9]\d*)|0)){2}$'));

        result = await checkFunctionDeployed(pgClient, plv8GetPostgresVersion);
        expect(result.rows[0].args).toMatch("");
    })

    it("should pass arg values", async () => {
        let pgCompute = new PgCompute();
        await pgCompute.init(pgClient);

        let a = 1, b = 2, c = 3;
        let result = await pgCompute.run(pgClient, plv8SumOfThree, a, b, c);

        expect(result).toBe(a + b + c);

        result = await checkFunctionDeployed(pgClient, plv8SumOfThree);
        expect(result.rows[0].args).toContain("int");
    })

    it("should fail due to invalid arguments", async () => {
        let pgCompute = new PgCompute();
        await pgCompute.init(pgClient);

        await expect(
            pgCompute.run(pgClient, plv8SumOfThree, 1, 2, 'test')).rejects.toThrow("invalid input syntax for type integer");


        await expect(
            pgCompute.run(pgClient, plv8SumOfThree, 1, 2)).rejects.toThrow("Function arguments mismatch");

        await expect(
            pgCompute.run(pgClient, plv8SumOfThree, 1, true, 3)).
            rejects.toThrow("does not exist");
    })

    it("should create custom schema", async () => {
        let schema = "tracker";
        pgComputeCustomSchema = new PgCompute(DeploymentMode.AUTO, schema);

        await pgComputeCustomSchema.init(pgClient);

        let result = await pgClient.query({
            text: "SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1",
            values: [schema]
        });

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].schema_name).toMatch(schema);

        result = await pgComputeCustomSchema.run(pgClient, trackerSchemaFunction);

        expect(result[0].now).toBeDefined();

        await checkFunctionDeployed(pgClient, trackerSchemaFunction, schema);

        //check the function doesn't exist in the public schema
        result = await pgClient.query({
            text: "select * from pg_compute where name = $1",
            values: [trackerSchemaFunction.name]
        });
        expect(result.rows.length).toBe(0);
    })

    it("should not redeploy function", async () => {
        let pgCompute = new PgCompute();
        await pgCompute.init(pgClient);


        let result = await pgCompute.run(pgClient, plv8TestSum);
        expect(result).toBe(5);

        result = await checkFunctionDeployed(pgClient, plv8TestSum);
        const oldHashCode = result.rows[0].body_hashcode;

        // Should not redeploy the function because the implementation is
        // re-checked only when your recreate the compute object or restart the app.
        result = await deployTestSumV2(pgClient, pgCompute);
        expect(result).toBe(5);

        result = await checkFunctionDeployed(pgClient, plv8TestSum);
        expect(result.rows[0].body_hashcode).toMatch(oldHashCode);
    })

    it("should redeploy function", async () => {
        let pgCompute = new PgCompute();
        await pgCompute.init(pgClient);


        let result = await pgCompute.run(pgClient, plv8TestSum);
        expect(result).toBe(5);

        result = await checkFunctionDeployed(pgClient, plv8TestSum);
        const oldHashCode = result.rows[0].body_hashcode;

        // Presently, the function implementation is re-checked 
        // only when you recreate the compute object or restart the app.
        pgCompute = new PgCompute();
        await pgCompute.init(pgClient);

        result = await deployTestSumV2(pgClient, pgCompute);
        expect(result).toBe(15);

        result = await checkFunctionDeployed(pgClient, plv8TestSum);
        expect(result.rows[0].body_hashcode).not.toMatch(oldHashCode);
    })

    it("should fail because function is not deployed manually", async () => {
        let pgCompute = new PgCompute(DeploymentMode.MANUAL);
        await pgCompute.init(pgClient);

        await expect(pgCompute.run(pgClient, sampleManualDeployFunction, 5)).
            rejects.toThrow("function public.samplemanualdeployfunction(integer) does not exist");
    })

    it("should execute manually deployed function", async () => {
        let pgCompute = new PgCompute(DeploymentMode.MANUAL);
        await pgCompute.init(pgClient);

        const stmt = "create function sampleManualDeployFunction(a int) returns JSON as $$" +
            "let b = a + 5; return b;" +
            "$$ language plv8;"

        await pgClient.query(stmt);

        let result = await pgCompute.run(pgClient, sampleManualDeployFunction, 5);
        expect(result).toBe(10);
    })

    it("should support a connection pool", async () => {
        let pgCompute = new PgCompute();
        await pgCompute.init(pgPool);

        let result = await pgCompute.run(pgPool, plv8TestSum);
        expect(result).toBe(5);
    })
});

async function checkFunctionDeployed(pgClient, func, schema) {
    let funcName = func.name;
    let result;

    if (schema != undefined) {
        result = await pgClient.query({
            text: "select * from " + schema + ".pg_compute where name = $1",
            values: [funcName]
        });
    } else {
        result = await pgClient.query({
            text: "select * from pg_compute where name = $1",
            values: [funcName]
        });
    }

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].name).toMatch(funcName);
    expect(result.rows[0].body_hashcode.length).toBeGreaterThan(5);

    return result;
}

function plv8TestSum() {
    let a = 2;
    let b = 3;

    return a + b;
}

function plv8GetPostgresVersion() {
    let json_result = plv8.execute('SELECT version(), plv8_version()');
    return json_result;
}

function plv8SumOfThree(a, b, c) {
    return a + b + c;
}

function trackerSchemaFunction() {
    return plv8.execute('select now()');
}

async function deployTestSumV2(pgClient, pgCompute) {
    function plv8TestSum() {
        let a = 2;
        let b = 3;

        return (a + b) + 10;
    }

    console.log(plv8TestSum.toString());

    return await pgCompute.run(pgClient, plv8TestSum);
}

function sampleManualDeployFunction(a) {

}