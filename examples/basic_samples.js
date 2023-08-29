/**
 * Basic samples for the pg-compute module.
 * 
 * These samples are hello-world-style JavaScript functions that can be automatically
 * deployed and executed on your Postgres instance. Feel free to modify the functions' 
 * logic or argument list, the updated version of the function will be automatically redeployed for you.
 */

const { Client } = require("pg");

const { PgCompute } = require("../compute/pg_compute");

/**
 * Provide your database connectivity settings here.
 * 
 * Make sure your Postgres instance has the plv8 extension that was installed and configured 
 * using the `create extension plv8` command.
 */
const dbEndpoint = {
    host: "localhost",
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: "password"
}

function helloWorld(name) {
    let msg = "Hello World From " + name;

    // need to wrap a String into JSON
    return { msg };
}

function getPostgresVersion() {
    let json_result = plv8.execute('SELECT version()');

    // returns JSON in the [{"version":"version_value"}] format
    return json_result;
}

function getDatabaseTime() {
    let json_result = plv8.execute('SELECT now() as time');

    // returns JSON in the [{"time":"time_value"}] format
    return json_result;
}

function sumOfThree(a, b, c) {
    let sum = a + b + c;

    // do NOT need to wrap a Number into JSON
    return sum;
}

(async () => {
    // Open a database connection
    const dbClient = new Client(dbEndpoint);
    await dbClient.connect();


    // Create and configure a PgCompute instance
    let compute = new PgCompute();
    await compute.init(dbClient);

    // Executing JS functions on the database.
    // Feel free to modify their implementation, the function will be redeployed automatically.
    let result;

    result = await compute.run(dbClient, helloWorld, "Groot");
    console.log("Sample 1:\n " + result.msg + "\n");

    result = await compute.run(dbClient, getPostgresVersion);
    console.log("Sample 2:\n Postgres version: " + result[0].version + "\n");

    result = await compute.run(dbClient, getDatabaseTime);
    console.log("Sample 3:\n Database time: " + JSON.stringify(result) + "\n");

    result = await compute.run(dbClient, sumOfThree, 1, 2, 3);
    console.log("Sample 4:\n Sum of three: " + result + "\n");

    await dbClient.end();
})();