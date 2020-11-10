// 🍛 👨‍🍳 main curry
/**
 * jsonBuilder: func which is called with the last two functions calls. Preset and custom
 * code: it could be a 400, 403, 500 anything is a res status code
 * res : response object from express
 * preset: pre-fabricated message
 * custom message: typically the message the we get in a .catch()
 */
const resJson = jsonBuilder => code => res => preset => (custom = '') =>{
  console.log("ERROR:", code, preset, custom);
  res.status(code).json(jsonBuilder(preset)(custom))
}

  // Object handlers
const objBuilder = key => value => ({ [key]: value})
const concatObj = obj => key => preset => custom => ({
  ...obj,                         // {success : true/false}
  ...objBuilder(key)(preset),     // {type : ENUM_MSG}
  ...objBuilder('message')(custom)// {message : {Object}||'string'}
});

// custom message
const jsonSuccess = objBuilder('success');  // {sucess:...}
const objError = jsonSuccess(false);        // {sucess:false}
//const objSuccess = jsonSuccess(true);     // {sucess:true}
const errorObj = concatObj(objError);       // {success:false, xx:xx}}

// Defining the keys, error, success, etc..
// const resError = resJson(errorObj('error')) 
const resErrorMessage = resJson(errorObj('type'))

// Specify the code of the response
const badReqErr = resErrorMessage(400)
const forbiddenErr = resErrorMessage(403)
const notFoundErr = resErrorMessage(404);
const crashErr = resErrorMessage(500);

/**
 * Return an object with different error handlers.
 * each error handler could be a curry or a funcion
 * e400 or e500 are currified functions
 * preset400 or preset500 are simple functions
 * @param {obj} res response object from express
 */
const errorGenerator = res => ({
  //*bad request
  e400: badReqErr(res), // 🍛
  //usually for query params when you dont know which argument are missing
  presetE400: badReqErr(res)("MISSING_ARG"), //fn
  //* Unauthorized
  e403: forbiddenErr(res), // 🍛
  preset403: forbiddenErr(res)("NO_ACCESS"),
  //* not found
  e404: notFoundErr(res), // 🍛
  presetE404: notFoundErr(res)('NOT_FOUND'), //fn
  //* System error
  e500: crashErr(res), // 🍛
  presetE500: crashErr(res)('MONGOOSE_ERROR') //fn
})

module.exports = {
  errorGenerator
}