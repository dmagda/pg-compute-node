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
 * This sample demonstrates how to create a JavaScript function that calculates the monthly compound 
 * interest rate on the database end for all savings accounts. 
 * https://www.cuemath.com/monthly-compound-interest-formula/
 * 
 * This example embodies a real-world use case for functions executed on the database side. Typically,
 * financial institutions handle thousands, even millions, of customer accounts and must 
 * compute interest rates either monthly or based on other terms. Such computations are data-intensive
 * and computationally demanding. The logic must traverse all the existing accounts, compute interest based on
 * various criteria, and then save the updated data back to the database.
 * 
 * Implementing this logic on the application side would be less efficient and performant. Doing so would require 
 * transferring all the account details over the network from the database to the application and then back again after 
 * interest calculations are completed.
 */
const { Client } = require("pg");
const { sprintf } = require('sprintf-js')
const { PgCompute } = require("../compute/pg_compute");

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

    // Create a sample database
    await dbClient.query(
        "CREATE TABLE IF NOT EXISTS savings_account (" +
        "id int," +
        "principal numeric(13, 2)," +
        "annual_rate numeric(5, 2))"
    );

    await dbClient.query("TRUNCATE TABLE savings_account");

    await dbClient.query(
        "INSERT INTO savings_account VALUES " +
        "(1, 5000, 4.5)," +
        "(2, 3000, 4.5)," +
        "(3, 11000, 3.8)," +
        "(4, 32000, 4.0)," +
        "(5, 4500, 3.5)," +
        "(6, 31000, 3.6)," +
        "(7, 50000, 4.2)," +
        "(8, 1000, 3.5)," +
        "(9, 15000, 4.5)," +
        "(10, 10000, 4.1)"
    );

    return dbClient;
}

async function printAccounts(dbClient) {
    const result = await dbClient.query("SELECT * FROM savings_account");

    for (let i = 0; i < result.rowCount; i++)
        console.log(result.rows[i]);
}

/**
 * This function is executed on the database to calculate and add compound interest to all savings accounts on a monthly basis.
 * It's important to implement additional checks to ensure that the interest is applied exactly once each month.
 * 
 * @return {number} The total number of updated savings accounts.
 */
function addMontlyInterestRate() {
    const query = plv8.prepare('SELECT * FROM savings_account');
    let accountsCnt = 0;

    try {
        const cursor = query.cursor();

        try {
            let account, monthlyRate, interestForTheMonth;

            while (account = cursor.fetch()) {
                // Calculate monthly interest rate by divide the annual rate by 12.
                monthlyRate = (account.annual_rate / 100) / 12;

                // Calculate interest for the month
                interestForTheMonth = account.principal * monthlyRate;

                // Updating the principal by adding the calculated interest rate
                plv8.execute(
                    'UPDATE savings_account SET principal = $1 WHERE id = $2',
                    [account.principal + interestForTheMonth, account.id]);

                accountsCnt++;
            }

        } finally {
            cursor.close();
        }
    } finally {
        query.free();
    }

    return accountsCnt;
}

(async () => {
    // Open a database connection
    const dbClient = await initDatabase();

    console.log("Accounts before the interest calculation:");
    await printAccounts(dbClient);

    // Create and configure a PgCompute instance
    let compute = new PgCompute();
    await compute.init(dbClient);

    // Calculate and add the interest rate on the database end
    const result = await compute.run(dbClient, addMontlyInterestRate);
    console.log(sprintf('\nAdded monthly interest rate to %d accounts\n', result));

    console.log("Accounts after the calculation:");
    await printAccounts(dbClient);

    await dbClient.end();
})();