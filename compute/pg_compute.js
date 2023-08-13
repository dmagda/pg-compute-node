const { Deployment, DeploymentMode } = require("./deployment.js");

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

    constructor(dbSchema = "public", deploymentMode = DeploymentMode.AUTO) {
        this.#dbSchema = dbSchema;
        this.#deploymentMode = deploymentMode;
    }

    async init(dbClient) {
        this.#deployment = new Deployment(this.#deploymentMode, this.#dbSchema);

        await this.#deployment.init(dbClient);
    }

    /**
     * The function executes a plv8 function in the database.
     */
    async run(dbClient, plv8Func, ...args) {
        // TODO: decide what to do with the `dbClient`. You need it for the listen/notify on the deployment end.
        // For the scenarios if a function is redeployed in a different session.
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

            await this.#checkFunctionWithArgsExists(dbClient, funcName, funcBody, argNames, args);
            funcExecStmt = PgCompute.#prepareExecStmtWithArgs(funcName, args);
        } else {
            await this.#checkFunctionExists(dbClient, funcName, funcBody);
            funcExecStmt = PgCompute.#prepareExecStmt(funcName);
        }

        // console.debug("Generated function create statement:\n" + funcCreateStmt);
        // console.debug("Generated function exec statement:\n" + funcExecStmt);

        // TODO: handle database errors
        let result = await dbClient.query(funcExecStmt);

        return result.rows[0][funcName.toLowerCase()];
    }

    async #checkFunctionExists(dbClient, funcName, funcBody) {
        await this.#deployment.checkExists(dbClient, funcName, null, funcBody);
    }

    async #checkFunctionWithArgsExists(dbClient, funcName, funcBody, argsNames, argsValues) {
        let argsStr = "";
        let arg, pgType;

        for (let i = 0; i < argsValues.length; i++) {
            arg = argsValues[i];
            pgType = PgCompute.#getPostgresType(arg);

            argsStr += argsNames[i] + " " + pgType + ", ";
        }

        argsStr = argsStr.slice(0, argsStr.length - 2).trim();

        await this.#deployment.checkExists(dbClient, funcName, argsStr, funcBody);
    }

    static #prepareExecStmt(funcName) {
        return "select " + funcName + "();"
    }

    static #prepareExecStmtWithArgs(funcName, argsValues) {
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

        return "select " + funcName + "(" + argsStr + ");"
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
