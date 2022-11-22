# Giftcards Puppis Backend

This project stores the source code for Giftcards backend.

## Technologies

- NodeJs
- Express.js
- Passport.js

## Structure

The project is composed by six (6) main folders.

2. `routes` to handle all the requests and responses.
3. `utils` to store function to reuse or helpers.
4. `public` to create the views for documentation and errors.
5. `config` Handle the sessions and tokens with Passport.
6. `bin` to handle some server events.
7. `controllers` to define the business logic. It contains all the implementations for giftcards, logistics, catalog, subscriptions, comerssia, etc.

## Contribution

Clone the project. Don't forget to add a SSH key to your account.

```
https://github.com/Puppis-Colombia/giftcardspuppis.git
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

