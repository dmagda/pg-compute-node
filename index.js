"use strict";

const { Pool, Client } = require("pg");

const { PgCompute } = require("./compute/pg_compute");

const db_endpoint = {
    host: "localhost",
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: "password"
}


async function openClientConnection() {
    const db_client = new Client(db_endpoint);
    await db_client.connect();

    return db_client;
}

// Database function/stored procedure writted in Java Script
async function plv8GetPostgresVersion() {
    let json_result = plv8.execute('SELECT version(), plv8_version()');
    return json_result;
}

async function plv8GetCurrentTime(a, b, c) {
    let d = (a + b) * c;
    let json_result = plv8.execute('SELECT now(),' + d + ' as sum');
    return json_result;
}

async function plv8PassString(str) {
    let json_result = plv8.execute("SELECT CONCAT('Hello',' ','" + str + "') as str");

    return json_result;
}

(async () => {
    const db_client = await openClientConnection();

    const compute = new PgCompute();

    await compute.init(db_client);

    let result;

    // This is how you execute the function
    result = await compute.run(db_client, plv8GetCurrentTime, 2, 3, 2);
    console.log(result);

    result = await compute.run(db_client, plv8GetPostgresVersion);
    console.log(result);

    result = await compute.run(db_client, plv8PassString, "world");
    console.log(result);

    await db_client.end();
})();