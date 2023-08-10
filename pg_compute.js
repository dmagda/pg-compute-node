module.exports = {
    run: async function (dbClient, plv8Func, ...args) {
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

        var funcCreateStmt;
        var funcExecStmt;

        if (funcArgsCnt > 0) {
            const argNames = parseFunctionArguments(funcStr);
            funcCreateStmt = prepareFunctionWithArgs(funcName, funcBody, argNames, args);
            funcExecStmt = prepareExecStmtWithArgs(funcName, args);
        } else {
            funcCreateStmt = prepareFunction(funcName, funcBody);
            funcExecStmt = prepareExecStmt(funcName);
        }

        // console.debug("Generated function create statement:\n" + funcCreateStmt);
        // console.debug("Generated function exec statement:\n" + funcExecStmt);

        const result = await dbClient.query(funcCreateStmt + funcExecStmt);

        return result[1].rows[0][funcName.toLowerCase()];
    }
}

const JS_TO_POSTGRES_TYPE_MAPPING = {
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

const MIN_INT = Math.pow(-2, 31) // -2147483648
const MAX_INT = Math.pow(2, 31) - 1 // 2147483647

function parseFunctionArguments(funcStr) {
    const funcArgs = funcStr.substring(funcStr.indexOf("(") + 1, funcStr.indexOf(")")).split(",");

    for (i = 0; i < funcArgs.length; i++)
        funcArgs[i] = funcArgs[i].trim();

    return funcArgs;
}

function prepareFunction(funcName, funcBody) {
    return "create or replace function " + funcName + "() returns JSON as $$" +
        funcBody +
        "$$ language plv8;"
}

function prepareFunctionWithArgs(funcName, funcBody, argsNames, argsValues) {
    var argTypes = [];
    var argsStr = "";

    for (i = 0; i < argsValues.length; i++) {
        arg = argsValues[i];
        pgType = getPostgresType(arg);

        argsStr += argsNames[i] + " " + pgType + ", ";
    }

    argsStr = argsStr.slice(0, argsStr.length - 2);

    return "create or replace function " + funcName + "(" + argsStr + ") returns JSON as $$" +
        funcBody +
        "$$ language plv8;"
}

function prepareExecStmt(funcName) {
    return "select " + funcName + "();"
}


function prepareExecStmtWithArgs(funcName, argsValues) {
    var argsStr = "";

    argsValues.forEach(arg => {
        pgType = getPostgresType(arg);

        if (pgType == "text")
            argsStr += "'" + arg + "',";
        else
            argsStr += arg + ",";
    });

    argsStr = argsStr.slice(0, argsStr.length - 1);

    return "select " + funcName + "(" + argsStr + ");"
}

function getPostgresType(arg) {
    var type = typeof (arg);
    var pgType = undefined;

    if (type == "number") {
        if (Number.isInteger(arg)) {
            pgType = JS_TO_POSTGRES_TYPE_MAPPING[arg < MIN_INT || arg > MAX_INT ? "long" : "int"];
        } else {
            pgType = JS_TO_POSTGRES_TYPE_MAPPING["float"];
        }
    } else if (type == "object") {
        type = Object.prototype.toString.call(arg);
        pgType = JS_TO_POSTGRES_TYPE_MAPPING[type];
    } else {
        pgType = JS_TO_POSTGRES_TYPE_MAPPING[type];
    }

    if (pgType == undefined)
        throw new Error("Unsupported argument type: " + type);

    return pgType;
}