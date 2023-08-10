const { Pool, Client } = require("pg");

var compute = require("./pg_compute");

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
    var json_result = plv8.execute('SELECT version(), plv8_version()');
    return json_result;
}

async function plv8GetCurrentTime(a, b, c) {
    var d = (a + b) * c;
    var json_result = plv8.execute('SELECT now(),' + d + ' as sum');
    return json_result;
}

(async () => {
    const db_client = await openClientConnection();

    // This is how you execute the function
    // var result = await compute.run(db_client, plv8_get_postgres_version);
    // console.log(result);

    var result = await compute.run(db_client, plv8GetCurrentTime, 2, 3, 2);
    console.log(result);

    result = await compute.run(db_client, plv8GetPostgresVersion);
    console.log(result);

    await db_client.end();
})();