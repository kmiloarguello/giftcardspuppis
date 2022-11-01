require('dotenv').config()
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');

//import routes
const giftcardsRouter = require('./routes/giftcards.routes');
const ordersRouter = require('./routes/orders.routes');
const logisticsRouter = require('./routes/logistics.routes');
const comerssiaRouter = require('./routes/comerssia.routes');

const app = express();
app.use(cors());

//Your Express app needs to use CORS (Cross-Origin Resource Sharing)
app.use(cors());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", '*');
  res.header("Access-Control-Allow-Credentials", true);
  res.header('Access-Control-Allow-Methods', '*');
  res.header("Access-Control-Allow-Headers", 'Origin,X-Requested-With,Content-Type,Accept,content-type,application/json');
  next();
});

// Body parser middleWare
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

// Use routes
app.use('/api', giftcardsRouter);
app.use('/api/orders',ordersRouter);
app.use('/api/logistics', logisticsRouter);
app.use('/api/comerssia', comerssiaRouter);

// Tasks
require('./jobs/insider.job');

// view engine setup
app.set('views', path.join(__dirname, 'public/views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


// catch 404 and forward to error handler
app.use((req, res, next) => next(createError(404)) );

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

 const port = process.env.PORT || 5000;
 app.listen(port, () => console.log(`Server running on port ${port}`));

module.exports = app;
