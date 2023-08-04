module.exports = {
    run: async function (db_client, plv8_func) {
        const func_str = plv8_func.toString();

        const func_name = plv8_func.name;
        const func_body = func_str.substring(
            func_str.indexOf("{") + 1,
            func_str.lastIndexOf("}")
        );

        const query =
            "create or replace function " + func_name + "() returns JSON as $$" +
            func_body +
            "$$ language plv8;" +
            "select " + func_name + "();"

        const result = await db_client.query(query);

        return result[1].rows[0][func_name];
    }
}