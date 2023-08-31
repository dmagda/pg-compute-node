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

/**
 * Demonstrates the use of the manual deployment mode with the PgCompute APIs.
 * 
 * The @type {DeploymentMode.MANUAL} mode assumes that a database function (stored procedure)
 * has already been manually created on the database side. With this mode, the application
 * only needs to invoke the function by providing its name and the required arguments.
 * 
 */
const { Client, ClientConfig } = require("pg");
const { sprintf } = require('sprintf-js')
const { PgCompute } = require("../compute/pg_compute");
const { DeploymentMode } = require("../compute/deployment");

/**
 * @type {ClientConfig} - database connectivity settings.
 * 
 * Make sure your PostgreSQL instance has the plv8 extension installed and configured 
 * with the `create extension plv8` command.
 */
const dbEndpoint = {
    host: "localhost",
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: "password"
}

async function initDatabase(name) {
    // Open a database connection
    const dbClient = new Client(dbEndpoint);
    await dbClient.connect();

    // Pre-creating (manually deploying) the database function.
    await dbClient.query(
        "create or replace function helloWorldPreCreated (name text) returns JSON as $$" +
        "   let msg = 'Hello World from ' + name; " +
        "   return {msg};" +
        "$$ language plv8;"
    );

    console.log("Pre-created the `helloWorldPreCreated` function on the database\n");

    return dbClient;
}

/**
 * A database function interface with no implementation.
 * @type {PgCompute} can use such interfaces to execute database functions
 * that are pre-created (deployed) manually. 
 * 
 * @param {string} name - name to add to the hello world message.
 * @returns {JSON} a JSON object containing the `msg` field. 
 */
function helloWorldPreCreated(name) { }

(async () => {
    // Open a database connection
    const dbClient = await initDatabase();

    // Creating a PgCompute instance that can execute manually pre-created database functions.
    let compute = new PgCompute(DeploymentMode.MANUAL);
    await compute.init(dbClient);

    // Execute the pre-created function.
    console.log("Executing the pre-created function:")
    const result = await compute.run(dbClient, helloWorldPreCreated, 'Mary');
    console.log("   Result: " + result.msg);

    await dbClient.end();
})();