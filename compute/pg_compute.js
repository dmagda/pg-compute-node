const { Deployment, DeploymentMode } = require("./deployment.js");
const { Pool, Client } = require("pg");
/**
 * 
 */
class PgCompute {
    static #JS_TO_POSTGRES_TYPE_MAPPING = {
        "int": "int4",
        "long": "int8",
        "bigint": "bigint",
        "float": "float4",
        "boolean": "bool",
        "string": "text",
        "[object Boolean]": "bool",
        "[object Date]": "date",
        "[object String]": "text"
    };

    static #MIN_INT = Math.pow(-2, 31) // -2147483648
    static #MAX_INT = Math.pow(2, 31) - 1 // 2147483647

    /** Database schema that stores plv8 functions. */
    #dbSchema;

    /** Functions deployment mode. */
    #deploymentMode;

    /** Deployment object for the current sesison. */
    #deployment;

    constructor(deploymentMode = DeploymentMode.AUTO, dbSchema = "public") {
        this.#dbSchema = dbSchema;
        this.#deploymentMode = deploymentMode;
    }

    async init(dbClient) {
        if (dbClient == undefined)
            throw new Error("Undefined client connection. Make sure to pass a valid client connection");

        let connection = await this.#getConnection(dbClient);

        this.#deployment = new Deployment(this.#deploymentMode, this.#dbSchema);

        try {
            await this.#deployment.init(connection);
        } finally {
            this.#releaseConnection(dbClient, connection);
        }
    }

    /**
     * The function executes a plv8 function in the database.
     */
    async run(dbClient, plv8Func, ...args) {
        let connection = await this.#getConnection(dbClient);

        try {
            const funcStr = plv8Func.toString();

            const funcName = plv8Func.name;
            const funcArgsCnt = plv8Func.length;

            const funcBody = funcStr.substring(
                funcStr.indexOf("{") + 1,
                funcStr.lastIndexOf("}")
            );

            if ((funcArgsCnt > 0 && args === undefined) || (args !== undefined && args.length != funcArgsCnt)) {
                throw new Error("Function arguments mismatch. Expected " + funcArgsCnt + ", received " + args.length);
            }

            let funcExecStmt;

            if (funcArgsCnt > 0) {
                const argNames = PgCompute.#parseFunctionArguments(funcStr);

                await this.#checkFunctionWithArgsExists(connection, funcName, funcBody, argNames, args);
                funcExecStmt = PgCompute.#prepareExecStmtWithArgs(this.#dbSchema, funcName, args);
            } else {
                await this.#checkFunctionExists(connection, funcName, funcBody);
                funcExecStmt = PgCompute.#prepareExecStmt(this.#dbSchema, funcName);
            }

            let result = await connection.query(funcExecStmt);

            return result.rows[0][funcName.toLowerCase()];
        } finally {
            this.#releaseConnection(dbClient, connection);
        }
    }

    async #getConnection(dbClient) {
        let connection;

        if (dbClient instanceof Pool)
            connection = await dbClient.connect();
        else
            connection = dbClient;

        return connection;
    }

    #releaseConnection(dbClient, connection) {
        if (dbClient instanceof Pool && connection != undefined)
            connection.release();
    }

    async #checkFunctionExists(connection, funcName, funcBody) {
        await this.#deployment.checkExists(connection, funcName, null, funcBody);
    }

    async #checkFunctionWithArgsExists(connection, funcName, funcBody, argsNames, argsValues) {
        let argsStr = "";
        let arg, pgType;

        for (let i = 0; i < argsValues.length; i++) {
            arg = argsValues[i];
            pgType = PgCompute.#getPostgresType(arg);

            argsStr += argsNames[i] + " " + pgType + ", ";
        }

        argsStr = argsStr.slice(0, argsStr.length - 2).trim();

        await this.#deployment.checkExists(connection, funcName, argsStr, funcBody);
    }

    static #prepareExecStmt(schema, funcName) {
        return "select " + schema + "." + funcName + "();"
    }

    static #prepareExecStmtWithArgs(schema, funcName, argsValues) {
        let argsStr = "";
        let pgType;

        argsValues.forEach(arg => {
            pgType = PgCompute.#getPostgresType(arg);

            if (pgType == "text")
                argsStr += "'" + arg + "',";
            else
                argsStr += arg + ",";
        });

        argsStr = argsStr.slice(0, argsStr.length - 1);

        return "select " + schema + "." + funcName + "(" + argsStr + ");"
    }

    static #parseFunctionArguments(funcStr) {
        const funcArgs = funcStr.substring(funcStr.indexOf("(") + 1, funcStr.indexOf(")")).split(",");

        for (let i = 0; i < funcArgs.length; i++)
            funcArgs[i] = funcArgs[i].trim();

        return funcArgs;
    }

    static #getPostgresType(arg) {
        let type = typeof (arg);
        let pgType = undefined;

        if (type == "number") {
            if (Number.isInteger(arg)) {
                pgType = PgCompute.#JS_TO_POSTGRES_TYPE_MAPPING[arg < PgCompute.#MIN_INT || arg > PgCompute.#MAX_INT ? "long" : "int"];
            } else {
                pgType = PgCompute.#JS_TO_POSTGRES_TYPE_MAPPING["float"];
            }
        } else if (type == "object") {
            type = Object.prototype.toString.call(arg);
            pgType = PgCompute.#JS_TO_POSTGRES_TYPE_MAPPING[type];
        } else {
            pgType = PgCompute.#JS_TO_POSTGRES_TYPE_MAPPING[type];
        }

        if (pgType == undefined)
            throw new Error("Unsupported argument type: " + type);

        return pgType;
    }
}

module.exports.PgCompute = PgCompute;
