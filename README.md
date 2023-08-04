# Prototype of Node.js Compute API for PostgreSQL

Postgres comes with the [plv8 extension](https://github.com/plv8/plv8) that allows to create and execute stored procedures in Java Script.

While this extension makes it easier for JS developers to create database logic in their favorite language, the approach still lacks developer experience. For instance?

1. The code still has to be wrapped in the following construction
    ```sql
    create or replace function my_java_script_function() returns JSON as $$
    my actual JS logic
    $$ language plv8;
    ```

2. Then this JS function has to be created or replaced every time a developer updates the logic. Any how do you update it? You execute the above statement via a PG driver or tool such as psql.

3. Then you need to call the created/replaced function to do some real work by sending  `SELECT my_java_script_function()` statement.

4. Then you use the PG driver to properly pass the result set.

5. Then... there is always something else.


# Better Developer Experience 

How a good developer experience should look like?

Instead of asking a developer to create the function below and follow the steps above to get it created/updated/executed

```sql
create or replace function my_java_script_function() returns JSON as $$
    var json_result = plv8.execute('SELECT version(), plv8_version()');
    return json_result;
$$ language plv8;
```

the developer should be able just to define a custom function anywhere in the app logic:
```javascript
async function plv8_get_postgres_version(db_client) {
    var json_result = plv8.execute('SELECT version(), plv8_version()');
    return json_result;
}
```

and then execute it the way like this (from the JS logic):
```javascript
var result = await compute.run(db_client, plv8_get_postgres_version);

console.log(result);
```

## Postgres Compute API

This project is a beta-testing of a potential compute API for PostgreSQL. The API lets bring more code to the data by improving the developer experience.

How to test:

1. Start a Postgres instance with the plv8 extension:
    ```shell
    mkdir ~/postgresql_data/

    docker run --name postgresql --net custom-network \
    -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password \
    -p 5432:5432 \
    -v ~/postgresql_data/:/var/lib/postgresql/data -d sibedge/postgres-plv8
    ```

2. Connect to the database and enable the extension:
    ```shell
    psql -h 127.0.0.1 -U postgres

    create extension plv8;
    ```

3. Start this app using `node index.js` command and you should see output similar to the following:
    ```javascript
    node index.js
    [
    {
        version: 'PostgreSQL 15.3 on aarch64-unknown-linux-musl, compiled by gcc (Alpine 12.2.1_git20220924-r4) 12.2.1 20220924, 64-bit',
        plv8_version: '3.1.7'
    }
    ]
    ```

4. Go ahead and edit the `plv8_get_postgres_version(...)` function in the `index.js` and restart the app. The function will be executed automatically in Postgres. For instance, you can change it to the following one:
    ```javascript
    async function plv8_get_postgres_version(db_client) {
        var json_result = plv8.execute('SELECT now()');
        return json_result;
    }
    ```
