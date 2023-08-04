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

async function plv8_get_postgres_version(db_client) {
    var json_result = plv8.execute('SELECT version(), plv8_version()');
    return json_result;
}

(async () => {
    const db_client = await openClientConnection();

    var result = await compute.run(db_client, plv8_get_postgres_version);

    console.log(result);

    await db_client.end();
})();