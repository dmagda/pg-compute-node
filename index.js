const { Client, ClientConfig } = require("pg");

const { PgCompute } = require("./compute/pg_compute");

const dbEndpoint = {
    host: "localhost",
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: "password"
}

function sum(a, b) {
    return (a + b) * 10;
}


(async () => {
    // Open a database connection
    const dbClient = new Client(dbEndpoint);
    await dbClient.connect();


    // Create and configure a PgCompute instance
    let compute = new PgCompute();
    await compute.init(dbClient);

    let result = await compute.run(dbClient, sum, 1, 2);
    console.log("Result:" + result);

    await dbClient.end();
})();