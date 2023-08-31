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

const crypto = require('crypto')

let DEBUG = false;

if (!DEBUG) {
    console.debug = function () { }
}

/**
 * Deployment mode for database functions. 
 */
class DeploymentMode {
    /** 
     * Deploys a JavaScript function on the database automatically if it doesn't 
     * already exist. The function is re-deployed if its implementation changes.
     */
    static AUTO = "AUTO";

    /**
     * Functions are pre-created manually on the database side. The PgCompute 
     * API then allows these functions to be invoked seamlessly from the application logic.
     */
    static MANUAL = "MANUAL";
}

/**
 * The object implementing the deployment modes. 
 */
class Deployment {

    static #DEPLOYMENT_TABLE_NAME = "pg_compute";
    static #DEPLOYMENT_TABLE_COLUMNS =
        "(name text NOT NULL," +
        "args text," +
        "body_hashcode text," +
        "PRIMARY KEY(name, args));";

    /** Deployment mode. */
    #deploymentMode;

    /** Schema name. */
    #schema;

    /** Full meta table name */
    #deploymentTableFullName;

    /** */
    #deploymentTable = {};

    constructor(mode = DeploymentMode.AUTO, schema = "public") {
        this.#deploymentMode = mode;
        this.#schema = schema;
    }

    async init(connection) {
        console.debug("Initialized '" + this.#deploymentMode + "' deployment mode for schema '" + this.#schema + "'");

        try {

            this.#schema = connection.escapeIdentifier(this.#schema);
            this.#deploymentTableFullName = this.#schema + "." + Deployment.#DEPLOYMENT_TABLE_NAME;

            await connection.query("CREATE SCHEMA IF NOT EXISTS " + this.#schema);

            await connection.query("CREATE TABLE IF NOT EXISTS " +
                this.#deploymentTableFullName + Deployment.#DEPLOYMENT_TABLE_COLUMNS);

            await this.#loadDeploymentTable(connection);
        } catch (error) {
            error.message = "Failed to initialize pg_compute. Reason:\n" + error.message;
            throw error;
        }
    }

    async checkExists(connection, funcName, funcArgs, funcBody) {
        if (this.#deploymentMode == DeploymentMode.MANUAL) {
            console.debug("Skipping the function validation for the 'MANUAL' deployment mode");
            return;
        }

        let funcRecord = this.#deploymentTable[funcName];

        if (funcArgs == undefined || funcArgs == null)
            funcArgs = "";

        if (funcRecord && funcRecord.checked) {
            console.debug("Skipping function impl check. Function '" + funcName + "' has already been verified during this session.");
            return;
        }

        const bodyHashCode = crypto.createHash('md5').update(funcBody).digest("hex");

        if (funcRecord == undefined) {
            await this.#createFunction(connection, funcName, funcArgs, funcBody, false);

            console.debug("Function '" + funcName + "' has been deployed");

        } else if ((funcRecord['args'] != funcArgs && funcRecord['bodyHashCode'] != bodyHashCode)
            || funcRecord['bodyHashCode'] != bodyHashCode) {

            await this.#createFunction(connection, funcName, funcArgs, funcBody, true);

            console.debug("Function '" + funcName + "' has been redeployed");
        } else {
            console.debug("Function '" + funcName + "' exists");
        }

        // No need to compare the function logic changes next time as long as
        // an application instance needs to be restarted to use the new function version at runtime.
        //
        // This ticket will adress scenarious when a function is changed by other app instances:
        // https://github.com/dmagda/pg_compute_nodejs/issues/4
        this.#deploymentTable[funcName].checked = true;
    }

    async #loadDeploymentTable(connection) {
        const result = await connection.query({
            text: "SELECT * FROM " + this.#deploymentTableFullName,
            name: "get_meta_" + this.#deploymentTableFullName
        });

        if (result.rows.length > 0) {
            result.rows.forEach(row => {
                this.#deploymentTable[row['name']] = { "args": row['args'], "bodyHashCode": row["body_hashcode"] };
            });
        }

        console.debug("Loaded the meta table:\n %j", this.#deploymentTable);
    }

    async #createFunction(connection, funcName, funcArgs, funcBody, redeploy) {
        let stmt;

        if (funcArgs == undefined) {
            stmt = "create or replace function " + this.#schema + "." + funcName + "() returns JSON as $$" +
                funcBody +
                "$$ language plv8;"
        } else {
            stmt = "create or replace function " + this.#schema + "." + funcName + "(" + funcArgs + ") returns JSON as $$" +
                funcBody +
                "$$ language plv8;"
        }

        const bodyHashCode = crypto.createHash('md5').update(funcBody).digest("hex");


        await connection.query("BEGIN;");
        await connection.query(stmt);

        if (redeploy) {
            await connection.query(
                {
                    name: "pg_compute_delete_" + this.#deploymentTableFullName,
                    text: "DELETE FROM " + this.#deploymentTableFullName + " WHERE name = $1 and args = $2;",
                    values: [funcName, this.#deploymentTable[funcName]["args"]]
                }
            );

        }

        await connection.query(
            {
                name: "pg_compute_insert_" + this.#deploymentTableFullName,
                text: "INSERT INTO " + this.#deploymentTableFullName + " VALUES($1,$2,$3);",
                values: [funcName, funcArgs, bodyHashCode]
            }
        );

        await connection.query("COMMIT;");

        this.#deploymentTable[funcName] = { "args": funcArgs, "bodyHashCode": bodyHashCode };

        console.debug("Meta table updated:\n %j", this.#deploymentTable);
    }


}

module.exports.Deployment = Deployment;
module.exports.DeploymentMode = DeploymentMode;