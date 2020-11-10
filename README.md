# Confflux Backend

This project stores the source code for Confflux backend.

## Technologies

- NodeJs
- MongoDB with Mongoose
- Express.js
- Passport.js

## Structure

The project is composed by six (6) main folders.

1. `models` to store all the database models in a `Mongoose` format. Each entity must be in a separated file.
2. `routes` to handle all the requests and responses. Right now the project does not use `sues.js`. It will be removed soon. Avoid to modify that file. Check the documentation to more information.
3. `utils` to store function to reuse or helpers.
4. `public` to create the views for documentation and errors.
5. `config` Handle the sessions and tokens with Passport.
6. `bin` to handle some server events.

## Documentation

The whole documentation was created manually and it is available for each route at:

### Establishement

http://rocky-temple-28113.herokuapp.com/establishment/docs

### Owner

http://rocky-temple-28113.herokuapp.com/owners/docs

### Users

http://rocky-temple-28113.herokuapp.com/users/docs

> The managers and sues will be depreciated in future versions. Avoid to use them.

## Contribution

Clone the project. Don't forget to add a SSH key to your account.

```
git@gitlab.com:conflux-solutions/web-backend.git
```
Install the packages
```
npm install
```
Add the `.env` file to the projec root folder, add the endpoints such as the database URI, the API key and so on. Below an example. You can ask those data in the slack group. The person in charge will give you the keys.

```
DB_HOST=localhost
PORT=5000
URI=XXXX
OR_KEY=XXXX
ACT_DB=XXXX
API_KEY=XXXX

```
Run the project.
```
npm start
```

### Debugging

The project has the command `npm run dev` for unix OS and for windows `npm run dev-win`. This commands enable hot reloading.

### Testing

The test were created using Mocha. To run the tests type and execute this command in console: `npm test`

