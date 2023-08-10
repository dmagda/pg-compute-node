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
        var arg = argsValues[i];

        if (i > 0)
            argsStr += ", ";

        if (typeof (arg) == "number") {
            //TODO: support other data types
            if (Number.isInteger(arg)) {
                argTypes[i] = "int";
            } else {
                throw new Error("Unsupported arg type: " + typeof (arg));
            }
        } else {
            throw new Error("Unsupported arg type: " + typeof (arg));
        }

        argsStr += argsNames[i] + " " + argTypes[i];
    }

    return "create or replace function " + funcName + "(" + argsStr + ") returns JSON as $$" +
        funcBody +
        "$$ language plv8;"
}

function prepareExecStmt(funcName) {
    return "select " + funcName + "();"
}


function prepareExecStmtWithArgs(funcName, argsValues) {
    //TODO: support all data types, presently the function will fail for strings that have to be
    //enclosed in '' brackets.
    argsStr = argsValues.join(", ");

    return "select " + funcName + "(" + argsStr + ");"
}