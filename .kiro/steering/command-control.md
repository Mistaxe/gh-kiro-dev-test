Assume windows environment using powershell when building and executing terminal commands. 

Commit and push changes to current branch after each task. 

Use JSON Schemas when building Fastify route schemas instead of Zod. Use Zod in route handler. 

Before creating .sql migration files, first create a set of queries to validate existing DB information/design and request that it be run and the output be shared with you. Then you can use this information make informed decisions about the code you generate - ensuring that the functions, columns, tables, etc... that are referenced actually exist. If they do not exist, ensure that the resulting migration creates them first (if they don't already exist). 