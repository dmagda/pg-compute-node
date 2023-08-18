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
    let d = (a + b) * c + 1000;
    let json_result = plv8.execute('SELECT now(),' + d + ' as oper');
    return json_result;
}

async function plv8PassString(str) {
    let json_result = plv8.execute("SELECT CONCAT('Hello',' ','" + str + "') as str");

    return json_result;
}

//TODO: try to use Jest testing framework and then 
// decide how to handle exceptions and async Promises
(async () => {
    const db_client = await openClientConnection();

    const compute = new PgCompute();

    await compute.init(db_client);

    let result;

    console.log("\n");

    // This is how you execute the function
    for (let i = 0; i < 3; i++) {
        result = await compute.run(db_client, plv8GetCurrentTime, 2, 3, 2);
        console.log(result);
        console.log("\n");
    }

    result = await compute.run(db_client, plv8GetPostgresVersion);
    console.log(result);
    console.log("\n");

    result = await compute.run(db_client, plv8PassString, "world");
    console.log(result);
    console.log("\n");

    await db_client.end();
})();