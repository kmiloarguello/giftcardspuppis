/**
 * File used to upload pictures to the server
 * It has some constraints such as only image format
 * It allows to upload photos for owner, user and establishment
 */

const multer = require('multer');
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, callback){
      callback(null,file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});


const fileConstraints = (file, callback) => {
  // Only allow images
  const fileType = /jpeg|jpg|png|gif/;
  // check extension i.e jpg
  const extName = fileType.test(path.extname(file.originalname).toLowerCase());
  // Check the MIME type i.e image/jpeg
  const mimeType = fileType.test(file.mimetype);

  if(extName && mimeType){
    // Sending the Error as NULL
    return callback(null, true);
  }else{
    return callback("ERROR: Only images are allowed");
  }
}
  
/**
 * Upload an image file with some constraints
 * TODO: Improve the code by using Lambda functions @josue
 */
const uploadOwner = multer({ 
    storage: storage,
    limits: { fileSize: 1000000 },
    fileFilter: (req,file,callback) => {
      fileConstraints(file, callback);
    } 
}).single('ownerprofilepic');

const uploadUser = multer({ 
  storage: storage,
  limits: { fileSize: 1000000 },
  fileFilter: (req,file,callback) => {
    fileConstraints(file, callback);
  } 
}).single('userprofilepic');

const uploadEstablishment = multer({ 
  storage: storage,
  limits: { fileSize: 1000000 },
  fileFilter: (req,file,callback) => {
    fileConstraints(file, callback);
  } 
}).array('establishmentpics');

module.exports = {
  uploadOwner,
  uploadUser,
  uploadEstablishment
}
  