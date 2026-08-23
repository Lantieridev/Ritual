const fs = require('fs');

let schema = fs.readFileSync('src/graphql/schema.ts', 'utf8');
schema = schema.replace("import './__probe'\n", "");
fs.writeFileSync('src/graphql/schema.ts', schema);
