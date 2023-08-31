[![Twitter URL](https://img.shields.io/twitter/url/https/twitter.com/denismagda.svg?style=social&label=Follow%20%40DenisMagda)](https://twitter.com/DenisMagda)

# PgCompute: a Client-Side PostgreSQL Extension for Database Functions

PgCompute is a client-side PostgreSQL extension that lets you execute JavaScript functions on the database directly from the application logic.

This means you can create, optimize, and maintain database functions similarly to the rest of the application logic by using your preferred IDE and programming language.

## Quick Example

Imagine you have the following function in your Node.js app:
```javascript
function sum(a, b) {
    let c = a + b;
    return c;
}
```

Now, suppose you want this function to run on PostgreSQL. Simply pass it to the `PgCompute` API like this:
```javascript
const dbClient = // an instance of the node-postgres module's Client or Pool.

// Create and configure a PgCompute instance
let compute = new PgCompute();
await compute.init(dbClient);

// Execute the `sum` function on the database
let result = await compute.run(dbClient, sum, 1, 2);
console.log(result); // prints `3`
```

By default, PgCompute operates in `DeploymentMode.AUTO` mode. This mode ensures a JavaScript function is automatically deployed to the database if it doesn't exist. Additionally, if you modify the function's implementation in your source code, PgCompute will handle the redeployment.

**Note**: PgCompute relies on [plv8 extension](https://github.com/plv8/plv8) of PostgreSQL. This extension enables JavaScript support within the database and must be installed prior to using PgCompute.

## Getting Started

Follow this guide to create a functional example from scratch.

First, start a PostgreSQL instance with the plv8 extensions. Let's use Docker:

1. Start a Postgres instance with plv8:
    ```shell
    mkdir ~/postgresql_data/

    docker run --name postgresql --net custom-network \
    -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password \
    -p 5432:5432 \
    -v ~/postgresql_data/:/var/lib/postgresql/data -d sibedge/postgres-plv8
    ```

2. Connect to the database and enable the plv8 extension:
    ```shell
    psql -h 127.0.0.1 -U postgres

    create extension plv8;
    ```

Next, create a Node.js project:

1. Initialize the project:
    ```shell
    npm init
    ```
2. Install the `pg` and `pg-compute` modules:
    ```shell
    npm install pg
    npm install pg-compute
    ```

Next, create the `index.js` file with the following logic:

1. Import node-postgres with PgCompute modules and create a database client configuration:
    ```javascript
    const { Client, ClientConfig } = require("pg");

    const { PgCompute } = require("pg_compute");

    const dbEndpoint = {
        host: "localhost",
        port: 5432,
        database: "postgres",
        user: "postgres",
        password: "password"
    }
    ```
2. Add a function that needs to be executed on the Postgres side:
    ```javascript
    function sum(a, b) {
        let c = a + b;
        return c;
    }
    ```
3. Add the following snippet to instantiate `Client` and `PgCompute` objects and to execute the `sum` function on Postgres:
    ```javascript
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
    ```
4. Run the sample:
    ```shell
    node index.js

    // Result:3
    ```    

Finally, give a try to the auto-redeployment feature:

1. Change the `sum` implementation as follows:
    ```javascript
    function sum(a, b) {
        return (a + b) * 10;
    }
    ```
2. Restart the app, the function will be redeployed and a new result will be printed out to the terminal:
    ```shell
    node index.js

    // Result:30
    ```    

## More Examples

Explore the `examples` folder for more code samples:

* `basic_samples.js` - comes with various small samples that show PgCompute capabilities.
* `savings_interest_sample.js` - calculates the monthly compound interest rate on the database end for all savings accounts. This is one of real-world scenarious when you should prefer using database functions.
* `manual_deployment_sample.js` - shows how to use the `DeploymentMode.MANUAL` mode. With that mode, the functions are pre-created manually on the database side but still can be invoked seamlessly from the application logic using PgCompute.

To start any example:

1. Import all required packages:
    ```shell
    npm i
    ```
2. Start an example:
    ```shell
    node {example_name.js}
    ```

**Note**, the examples include the PgCompute module from sources. If you'd like to run the examples as part of your own project, then import the module form the npm registry:
```javascript
const { PgCompute } = require("pg_compute");
```

## Testing

PgCompute uses Jest and Testcontainers for testing. 

So, if you decide to contribute to the project:

* Make sure to put new tests under the `test` folder
* Do a test run after introducing any changes: `npm test`

[![Twitter URL](https://img.shields.io/twitter/url/https/twitter.com/denismagda.svg?style=social&label=Questions%26Feedback)](https://twitter.com/DenisMagda)
