const express = require("express");
const router = express.Router();
const request = require("request");
const passport = require("passport");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
var cron = require('node-cron');
const fs = require("fs");

// Keys
const { mapQuestAPIKey } = require("../config/keys");

// Models
const Establishment = require("../models/Establishment");
const Category = require("../models/Category");
const Owner = require("../models/Owner")
const QrCode = require("../models/QrCode");
const Visits = require("../models/Visits");
const Shift = require("../models/Shifts");
const Opening_hours = require("../models/Opening_hours");
const Users = require("../models/Users");

// Utils
const { calculateDistance, fromKMtoM, createAutomaticCheckout } = require("../utils/utils");
const { errorGenerator } = require("../utils/curries");
const cloudinary = require("../utils/cloudinary");
const { uploadEstablishment } = require("../utils/multer");

// Helpers
Date.prototype.addHours= function(h){
  this.setHours(this.getHours()+h);
  return this;
};

/**
 * @route   GET /establishment/params
 * @desc    Gives the params available to the client
 * @todo    Store the values in a correct DB
 * @public
 */
router.get("/params", (_, res) => {
  res.json({
    name: "establishment_params",
    params: [
      {
        name: "Days",
        value: "Mo-Tu-We-Th-Fr-Sa-Su",
      },
      {
        name: "Categories",
        value: ["Pharmacie", "Supermarket", "Bakery", "Grocery", "Hospital"],
      },
      {
        name: "StatusAffluences",
        value: ["Empty", "Half", "Full"],
      },
    ],
  });
});



router.get("/docs", (req,res) => {
  res.render("establishment_docs")
});


/**
 * @route   POST /establishment/search
 * @desc    Search establishment by establishment's name
 * @param   {String} id
 * @private 
 */
router.get("/search/", async (req,res,next) => {
  const { presetE400, presetE404, presetE500 } = errorGenerator(res);

  let { query } = req.query;
  if(!query) return presetE400();

  // Check if the intend is search by category
  let search_by_category = await Category.find(
    { 
      // Search OR by Spanish OR by english OR by French
      $and: [ { $or: [{ name: new RegExp(query, "i")},{ name_es: new RegExp(query, "i")},{ name_fr: new RegExp(query, "i")} ] } ]
    }, 
    (err) => err ? e400(err)() : "");


  // Check if the intend is by searching by description
  let search_by_description = await Establishment.find({ description: new RegExp( query , "i") },(err) => err ? e400(err)() : "");

  if(search_by_category.length > 0){
    search_by_category.map(category => searchByEstablishment(req,res,true,category._id));
  } else if (search_by_description.length > 0){
    searchByEstablishment(req,res,false,"",true)
  }else{
    searchByEstablishment(req,res);
  }
});




/**
 * Search by Establishment
 * @param {Object} req 
 * @param {Object} res 
 * @param {Boolean} byCategory (Optional) Defines if the user searched by category
 * @param {String} id_category (Optional) Send the category'id to search all the establishment 
 */
const searchByEstablishment = async (req,res,byCategory=false, id_category="",byDescription= false) => {
  
  const { presetE500 } = errorGenerator(res);

  let query = "";
  if(byCategory){
    query = { id_category, isActive: true};
  }else if(byDescription){
    // Search ALL the items whose OR description fits OR name fits but ALL has an active property true
    query = { $and: [ { $or: [
          { description: new RegExp( req.query.query , "i") },
          { name: new RegExp( req.query.query , "i") } 
        ] 
      }, {isActive: true}
    ] } 
  }else{
    query = { name: new RegExp( req.query.query , "i") , isActive: true };
  }

  let search_by_establishment = await Establishment.find(query, null, {sort: {name: -1}}, (err) => err ? e400(err)() : "");
  
  let myEstablishments = Promise.all(search_by_establishment.map(async establishment => {

    let _opening_hours = await Opening_hours.findById(establishment.id_opening_hours, (err) => err ? e400(err)() : "");
    let category = await Category.findById(establishment.id_category, (err) => err ? e400(err)() : "");

    // New object for each iteration
    let newEstablishment = {};

    // Construct the object
    newEstablishment._id = establishment._id;
    newEstablishment.name = establishment.name;
    newEstablishment.phone = establishment.phone;
    newEstablishment.description = establishment.description;
    newEstablishment.category = category ? category.name : null;
    newEstablishment.isActive = establishment.isActive;
    newEstablishment.current_affluences = establishment.current_affluences;
    newEstablishment.max_affluences_allowed = establishment.max_affluences_allowed;
    newEstablishment.shift_attention_mins = establishment.shift_attention_mins || 10;
    newEstablishment.shift_schedule_max_hours = establishment.shift_schedule_max_hours;
    newEstablishment.checkin_max_min = establishment.checkin_max_min;
    newEstablishment.max_shifts = establishment.max_shifts;
    newEstablishment.max_persons_per_slot = establishment.max_persons_per_slot;
    newEstablishment.slot_size = establishment.slot_size;
    newEstablishment.enableShifting = establishment.enableShifting;
    newEstablishment.enable_ask_document = establishment.enable_ask_document;
    newEstablishment.enableShopping = establishment.enableShopping;
    newEstablishment.establishment_pics_url = establishment.establishment_pics_url || [];
    newEstablishment.num_per_shift = establishment.num_per_shift || null;
    newEstablishment.enable_num_people = establishment.enable_num_people || false;
    newEstablishment.opening_hours = {
      day: _opening_hours.day,
      open_hour: _opening_hours.open_hour,
      close_hour: _opening_hours.close_hour
    };
    newEstablishment.location = {
      longitude: establishment.location.longitude,
      latitude: establishment.location.latitude,
      address: establishment.location.address,
      city: establishment.location.city,
      stateCode: establishment.location.stateCode,
      postalCode: establishment.location.postalCode,
      countryCode: establishment.location.countryCode,
      country: establishment.location.country
    };

      return newEstablishment;
  }));

  myEstablishments
    .then(establishments => {

      let _establishments = establishments.filter(establishment => establishment);

      res.json({
        success: true,
        total: _establishments.length,
        values: _establishments
      });
    })
    .catch(presetE500);

}



/**
 * @route   POST /establishment/search-by-category
 * @desc    Search establishment by establishment's category and return a sorted list
 * @param   {String} category
 * @param   {Object} location i.e { "longitude": 12.123, "latitude" : 12.123 } 
 * @private 
 */
router.post("/search-by-category", function (req, res) {
  let {  category, location } = req.body;

  let URL_request = `http://www.mapquestapi.com/search/v3/prediction?key=${mapQuestAPIKey}&limit=10&collection=adminArea,poi,address,category,franchise,airport&q=${category}&location=${location.longitude},${location.latitude}`;

  request(URL_request, (error, reponse, body) => {
    if (error) res.status(400).json(error);
    body = JSON.parse(body);

    // Getting only the results
    // Skipping the index = 0
    let jsonOrigin = body.results.filter((_, index) => index > 0);

    // Shaping the JSON
    let arrayResult = jsonOrigin.map(establishment => {

      let long = establishment.place.geometry.coordinates[0];
      let lat = establishment.place.geometry.coordinates[1];
      
        return {
          name: establishment.name,
          distance: calculateDistance(establishment.location.latitude,establishment.location.longitude,lat,long),
          category,
          location: {
            longitude: establishment.place.geometry.coordinates[0],
            latitude: establishment.place.geometry.coordinates[1],
            city: establishment.place.properties.city,
            stateCode: establishment.place.properties.stateCode,
            postalCode: establishment.place.properties.postalCode,
            countryCode: establishment.place.properties.countryCode,
            country: establishment.place.properties.country,
            street: establishment.place.properties.street,
            type: establishment.place.properties.type,
            display_name: establishment.place.properties.display_name
          }
        };
    });

    // Sorting by smallest distance
    let arrayResultSort = arrayResult.sort((dist1,dist2) => dist1.distance - dist2.distance )

    res.json({
      total: arrayResult.length,
      values: arrayResultSort
    });
  });
});





/**
 * @route   GET /establishment/
 * @desc    Get all the available establishments
 * @param   {Number} lat Latitude
 * @param   {Number} lng Longitude
 * @param   {String} radius Distance from the current position
 * @param   {String} category Establishment's category
 * @public 
 */
router.get("/", async (req, res) => {
  
  const { e400,e404, presetE400, e500, presetE404, presetE500 } = errorGenerator(res);

  let { lat, lng, radius, category, offset, limit } = req.query;
  if( !lat || !lng || !category ) return presetE400();

  //let _radius = fromKMtoM(radius);

  Category
    .findOne({ 
      // Search OR by Spanish OR by english OR by French
      $and: [ { $or: [{name: category},{name_es: category},{name_fr: category} ] } ]
      }, (err,_category) => {
      if(err) return e400(err)();

      if(_category){
        // TODO: Implement search by radius on the function searchByEstablishment()
        searchByEstablishment(req,res,true,_category.id);
      }else{
        return presetE404("CATEGORY NOT FOUND");
      }
    });   
});









/**
 * @route   GET /establishment/get-by-owner
 * @desc    Get all the establishment by owner's id (The id cames into the token string)
 * @private
 */

router.get("/get-by-owner", passport.authenticate(["jwt", "google", "facebook"], { session: false }), async (req, res) => {
  
  const { e400, presetE400, e500, presetE404, presetE500 } = errorGenerator(res);

  let { _id, type } = await req.user;
  if(!_id || !type) return presetE400();
  if(/user/ig.test(type)) return res.status(401).send("Unauthorized");

  Establishment
    .find({ id_owner : _id }, (err, establishments) => {
      if(err) return e400(err)();

      let myEstablishments = Promise.all(establishments.map(async establishment => {

        let _opening_hours = await Opening_hours.findById(establishment.id_opening_hours, (err) => err ? e400(err)() : "");
        let category = await Category.findById(establishment.id_category, (err) => err ? e400(err)() : "");
        // New object for each iteration
        let newEstablishment = {};

        // Construct the object
        newEstablishment._id = establishment._id;
        newEstablishment.name = establishment.name;
        newEstablishment.phone = establishment.phone;
        newEstablishment.description = establishment.description;
        newEstablishment.category = category ? category.name : null;
        newEstablishment.current_affluences = establishment.current_affluences;
        newEstablishment.max_affluences_allowed = establishment.max_affluences_allowed;
        newEstablishment.shift_attention_mins = establishment.shift_attention_mins || 10;
        newEstablishment.shift_schedule_max_hours = establishment.shift_schedule_max_hours;
        newEstablishment.checkin_max_min = establishment.checkin_max_min;
        newEstablishment.max_shifts = establishment.max_shifts;
        newEstablishment.max_persons_per_slot = establishment.max_persons_per_slot;
        newEstablishment.slot_size = establishment.slot_size;
        newEstablishment.enableShifting = establishment.enableShifting;
        newEstablishment.enable_ask_document = establishment.enable_ask_document;
        newEstablishment.enableShopping = establishment.enableShopping;
        newEstablishment.establishment_pics_url = establishment.establishment_pics_url || [];
        newEstablishment.num_per_shift = establishment.num_per_shift || null;
        newEstablishment.enable_num_people = establishment.enable_num_people || false;
        newEstablishment.opening_hours = {
          day: _opening_hours.day,
          open_hour: _opening_hours.open_hour,
          close_hour: _opening_hours.close_hour
        };
        newEstablishment.location = {
          longitude: establishment.location.longitude,
          latitude: establishment.location.latitude,
          address: establishment.location.address,
          city: establishment.location.city,
          stateCode: establishment.location.stateCode,
          postalCode: establishment.location.postalCode,
          countryCode: establishment.location.countryCode,
          country: establishment.location.country
        };

        return newEstablishment;
      }));

      myEstablishments
        .then(establishments => {

          let _establishments = establishments.filter(establishment => establishment);

          res.json({
            success: true,
            total: _establishments.length,
            values: _establishments
          });
        })
        .catch(presetE500);
    });

});





/**
 * @route   GET /establishment/category
 * @desc    Get all the establishment category
 * @public 
 */
router.get("/category", (_, res) => {
  const { e400 } = errorGenerator(res);
  Category.find((err, category) => {
    if (err) return e400(err)();
    res.json({ 
      success: true,
      category
     });
  });
});








/**
 * @route   POST /establishment/category/new
 * @desc    It creates one category
 * @body   {String} name Category's name
 * @private
 */
router.post("/category/new", passport.authenticate(["jwt", "google", "facebook"], { session: false }), (req,res) => {
  let { name, name_es, name_fr, position } = req.body;
  const { e400, presetE400 } = errorGenerator(res);

  if( !name ) return presetE400();

  Category.find({ name }, (err, category) => {
    if(err) return e400(err)();

    if(category.length > 0) return e400("CATEGORY already exists.")();

    let newCategory = new Category({
      name,
      name_es,
      name_fr,
      position
    });

    newCategory.save((err,category) => {
      if(err) return e400(err)();

      res.json({
        success: true,
        category
      });
    });
  });

});






/**
 * @route   DELETE /establishment/category/remove
 * @desc    It removes one category
 * @param   {String} id Category's id
 * @private
 */
router.delete("/category/remove", passport.authenticate(["jwt", "google", "facebook"], { session: false }), (req, res) => {
  let { id } = req.query;
  const { presetE400, e400, presetE404 } = errorGenerator(res);

  if(!id || id === "undefined") return presetE400();

  Category.findOne({ _id: id }, (err, category) => {
    if(err) return e400(err)();

    if(category){
      // Delete first item found with commentId
      Category.deleteOne({ _id: id }, (err, result) => {
        if (err) return e400(err)();

        res.json({
          success: true,
          result
        });

      });
    }else{
      return presetE404();
    }
  });
});











/**
 * @route   POST /establishment/new
 * @desc    Create a new establishment
 * @body    {Object} category i.e { name: "Pharmacie" }
 * @body    {Object} location i.e { "longitude": 12.123, "latitude" : 12.123, ... } (See /new-location)
 * @body    {String} name
 * @body    {Number} phone
 * @body    {String} description
 * @body    {Boolean} isActive
 * @body    {Number} current_affluences
 * @body    {Number} max_affluences_allowed
 * @body    {Number} shift_attention_mins
 * @body    {Number} shift_schedule_max_hours
 * @body    {Number} checkin_max_min
 * @body    {Number} max_shifts
 * @body    {Number} max_persons_per_slot
 * @body    {String} category_name
 * @body    {Object} location, // Must be an object
 * @body    {Object} opening_hours
 * @private 
 */
router.post("/new", passport.authenticate(["jwt", "google", "facebook"], { session: false }), async (req,res) => {

  let { _id, type } = await req.user;
  const { e400, presetE400, e404 } = errorGenerator(res);

  let id_owner = _id;

  if(/user/ig.test(type)) return res.status(401).send("Unauthorized");

  let {
    name,
    phone,
    description,
    isActive,
    current_affluences,
    max_affluences_allowed,
    shift_attention_mins,
    shift_schedule_max_hours,
    checkin_max_min,
    max_shifts,
    max_persons_per_slot,
    category_name,
    location, // Must be an object
    opening_hours,
    slot_size, // in minutes
    enableShifting,
    establishment_pics_url,
    enable_ask_document,
    enableShopping,
    num_per_shift,
    enable_num_people
  } = req.body;

  // Validations
  if (typeof location !== "object") {
    console.log("Location " + location + " is undefined.");
    return presetE400();
  } else {
    // Approach:
    // 1. Store Location and keep its id
    // 2. Store Category and keept its id
    // 3. Store Establishment with previous ids

    // Receiving and building the Establishment model
    let newEstablishment = new Establishment({
      name,
      phone,
      description,
      isActive,
      current_affluences,
      max_affluences_allowed,
      shift_attention_mins,
      shift_schedule_max_hours,
      checkin_max_min,
      max_shifts,
      max_persons_per_slot,
      location,
      slot_size,
      enableShifting,
      establishment_pics_url,
      enable_ask_document,
      enableShopping,
      num_per_shift,
      enable_num_people
    });

    Category.findOne({ name: category_name }, (err, category) => {
      if (err) return e400(err)();

      if(category){
        newEstablishment.id_category = category._id;

        Owner
          .findOne({ _id: id_owner }, (err, owner) => {
            if(err) return e400(err)();

            if(owner){

              newEstablishment.id_owner = id_owner;

              if(typeof opening_hours !== "object") {
                console.log("Invalid opening hours");
                return presetE400();
              }

              let newOpening_hours = new Opening_hours({
                day: opening_hours.day,
                open_hour: opening_hours.open_hour,
                close_hour: opening_hours.close_hour
              });

              newOpening_hours.save(err => {
                if(err) return e400(err)();

                newEstablishment.id_opening_hours = newOpening_hours._id;

                // Saving Establishment
                newEstablishment.save(function (err, establishment) {
                  if (err) return e400(err)();
    
                  res.json({
                    success: true,
                    establishment
                  });
                });
              });
              
            }else{
              console.log("Owner " + id_owner +" not found");
              return e404("NOT_FOUND")("Owner not found");
            }

          });

      }else{
        return e404("NOT_FOUND")("Category " + category_name + " not found");
      }
    });
  }
});









/**
 * @route   PUT /establishment/update
 * @desc    Update one o many fields on the establishment model.
 *          The id must come as param
 *          The data to update must come inside of body
 * @public
 */
router.put("/update",  passport.authenticate(["jwt", "google", "facebook"], { session: false }), (req,res) => {

  let { id } = req.query;
  const { e400, presetE400, presetE404, e404 } = errorGenerator(res);

  if(!id || id === "undefined") return presetE400();

  Establishment
    .findByIdAndUpdate(id, req.body, async (err, establishment) => {
      if (err) return e400(err)();

      if(establishment){

        // If the user wants to update the timetable -> the input object value is `opening_hours`
        await Opening_hours.findByIdAndUpdate(establishment.id_opening_hours, req.body.opening_hours, (err) => {
          if(err) return e400(err)();
        });
        
        // If the user wants to update the category, the system does not change the Category's entity.
        // Instead, it verifies whether the input category name and the current one are different
        // If those values are differents -> The system reupdates Establishment again with the value id_category 
        let current_category = await Category.findById(establishment.id_category);

        if(req.body.category_name && current_category.name != req.body.category_name){
          let new_category = await Category.findOne({ name: req.body.category_name }, (err) => {
            if(err) return e400(err)();
          });
          
          if(!new_category) return presetE404();
          await Establishment.findByIdAndUpdate(id, { id_category: new_category._id });
        }

        return res.json({
          success: true,
          message: "Establishment successfully updated",
          updated: req.body,
          establishment: {
            id: establishment._id
          }
        });

      }else{
        return e404("NOT_FOUND")("Establishment not found");
      }
    });
});







/**
 * @route   PUT /establishment/update-state
 * @desc    Update the status on the establishment
 * @private
 */
router.put("/update-state", passport.authenticate(["jwt", "google", "facebook"], { session: false }), async (req,res) => {
  const { presetE400,e400,e404 } = errorGenerator(res);

  let { type } = await req.user; // User's type
  let { id } = req.query || req.params; // Establishment's id

  if(/user/ig.test(type)) return res.status(401).send("Unauthorized");

  if(!id || id === "undefined") return presetE400();

  let { isActive } = req.body;

  Establishment
    .findByIdAndUpdate(id, { isActive }, (err, establishment) => {
      if(err) return e400(err)();
      if(establishment){
        return res.json({
          success: true,
          message: "Establishment updated",
          state_establishment: isActive,
          establishment
        });
      }else{
        return e404("NOT_FOUND")("The establishment is undefined");
      }
    });
});






/**
 * @route   GET /establishment/get-by-id/
 * @desc    It gets an establishment by Id
 * @param   {String} id establishment's id
 * @public
 */
router.get("/get-by-id", (req,res) => {
  let { id } = req.query || req.params;
  const { e400, e404, presetE400 } = errorGenerator(res);

  if(!id) return presetE400("ID is missing");

  Establishment.findOne({ _id: id }, async (err, establishment) => {
    if(err) return e400(err)();

    if(establishment){
      let opening_hours = await Opening_hours.findById(establishment.id_opening_hours, (err) => err ? e400(err)() : "");
      let category = await Category.findById(establishment.id_category, (err) => err ? e400(err)() : "");

      let _establishment = {};
          _establishment._id = establishment._id;
          _establishment.name = establishment.name;
          _establishment.phone = establishment.phone;
          _establishment.description = establishment.description;
          _establishment.category = category ? category.name : null;
          _establishment.isActive = establishment.isActive;
          _establishment.current_affluences = establishment.current_affluences;
          _establishment.max_affluences_allowed = establishment.max_affluences_allowed;
          _establishment.shift_attention_mins = establishment.shift_attention_mins || 10;
          _establishment.shift_schedule_max_hours = establishment.shift_schedule_max_hours;
          _establishment.checkin_max_min = establishment.checkin_max_min;
          _establishment.max_shifts = establishment.max_shifts;
          _establishment.max_persons_per_slot = establishment.max_persons_per_slot;
          _establishment.slot_size = establishment.slot_size;
          _establishment.enableShifting = establishment.enableShifting
          _establishment.enable_ask_document = establishment.enable_ask_document;
          _establishment.enableShopping = establishment.enableShopping;
          _establishment.opening_hours = opening_hours;
          _establishment.location = establishment.location;
          _establishment.establishment_pics_url = establishment.establishment_pics_url || [];
          _establishment.num_per_shift = establishment.num_per_shift || null;
          _establishment.enable_num_people = establishment.enable_num_people || false;
          _establishment.shifts_checked_at = establishment.shifts_checked_at || null;
          _establishment.orders_checked_at = establishment.orders_checked_at || null;
          
          return res.json({ success: true, establishment: _establishment });      
    }else{
      return e404("NOT_FOUND")("Establishment not found");
    }
  });

});






// @route   POST /establishment/uplad-photo
// @desc    Add one or many establishment photos
// @access  Private
router.post('/upload-photo', passport.authenticate(["jwt", "google", "facebook"], { session: false }) ,async (req, res, next) => {
  
  const { e400, presetE400, presetE404 } = errorGenerator(res);
  let { _id, type } = await req.user;
  let { id_establishment } = req.query;

  if(/user/ig.test(type)) return res.status(401).send("Unauthorized");
  if(!id_establishment) return presetE400();

  const uploader = async (path) => await cloudinary.uploads(path,"Establishments");

  uploadEstablishment(req,res, async (err) => {
    if(err) return e400(err)();
    if(req.files == undefined) return e400("INVALID")("There is not file to upload.");

    let urls = [];

    const files = req.files;

    for(const file of files){
      const { path } = file;
      let newUpload = await uploader(path);
      urls.push(newUpload.url);
      fs.unlinkSync(path);
    }

    Establishment.findOneAndUpdate({ _id: id_establishment ,id_owner: _id }, {establishment_pics_url: urls} , (err,establishment) => {
      if(err) return e400(err)();
      if(establishment){
        res.json({
          success: true,
          message: 'Files Uploaded!',
          files: urls
        });
      }else{
        return presetE404("Establishment is undefined");
      }
    });
  });
});







/**
 * @route   DELETE /establishment/remove
 * @desc    Delete an establishment
 * @param   {Number} id mandatory
 * @private 
 * @todo    Create it using passport
 */
router.delete("/remove", passport.authenticate(["jwt", "google", "facebook"], { session: false }), (req, res) => {
  let { id } = req.query;
  const { e400, presetE400, presetE404 } = errorGenerator(res);

  if(!id || id === "undefined") return presetE400();

  Establishment.findOne({ _id: id }, (err, establishment) => {
    if(err) return e400(err)();

    if(establishment){

      Opening_hours
        .deleteOne({ _id: establishment.id_opening_hours }, (err, resultHours) => {
          if(err) return e400(err)();

          if(resultHours){

            // Delete first item found with commentId
            Establishment.deleteOne({ _id: id }, (err, resultEstablishment) => {
              if (err) return e400(err)();

              res.json({
                success: true,
                result: resultEstablishment
              });

            });

          }else{
            return presetE404();
          }
        });

    }else{
      return presetE404();
    }
  });
});







/**
 * @route   POST /establishment/checkin
 * @desc    Compare token, validate location and make a reservation
 *        * Search by establishment id and compare if the qr code token is the same.
 *        * validate the location and compare if the checkin is close enough
 *        * Search in the ships if there is previus appointment with the user ID. IF not, make a reservation
 * @param   {String}  qr_code token mandatory
 * @param   {Date}    date exact moment of the reservation
 * @param   {id_user} id User doing the reservation (maybe is in the context)
 * @param   {location} object {lat long}
 * @private
 */
router.post(
  "/checkin",
  passport.authenticate(["jwt", "google", "facebook"], { session: false }),
  async (req, res) => {
    const { e400, presetE400, presetE404, e404, presetE500 } = errorGenerator(res);

    let { _id, email, type } = await req.user;

    if(/owner/ig.test(type)) return res.status(401).send("Unauthorized");

    const {qr_code, date, location } = req.body;
    if(!qr_code || !date || !location ) return presetE400();
    if(typeof date == "string") return presetE400();

    const ALLOWED_DISTANCE = 100; // meters
    const HOURS_MILLISECONDS = 3600000;

    if (!new RegExp("Bearer ", "ig").test(qr_code)) return presetE400();

    // Decode the qr code
    jwt.verify(
      qr_code.split(" ")[1],
      process.env.OR_KEY,
      (err, response) => {
        if(err) return e400(err)();

        let input_date = date;

        // This code is not expired
        if((input_date / 1000) < response.exp) {
          if (!new RegExp("_", "ig").test(response.qr_info)) return presetE400();

          let qr_id_establishment = response.qr_info.split("_")[0];
          let qr_date = response.qr_info.split("_")[1];

          QrCode.findOne(
            { id_establishment: qr_id_establishment },
            (err, qr) => {
              if (err) return e400(err)();

              if (qr) {
                // Check if there is an available shift with the same id
                Establishment.findOne({_id: qr_id_establishment, isActive: true }, async (err, establishment) => {
                  if (err) return e400(err)();

                  if(establishment){

                    //* Check max number of affluences
                    // The current people number must to be lower than the establishment's capacity
                    if(establishment.current_affluences >= establishment.max_affluences_allowed){
                      return e400("INVALID_FULL")("People inside is the maximum allowed.");
                    }

                    let lastDay = new Date(input_date);
                    lastDay.setDate(lastDay.getDate() + 1); // Until the end of the day
                    // Check if the user made an book before
                    let shift_by_user = await Shift.find(
                      { id_establishment: qr_id_establishment, 
                        id_users: _id, 
                        shift_date: { $lte: lastDay }, 
                        shift_checked: false }, 
                        null, 
                        {sort: {date: 1} }, (err) => err ? e400(err)() : "");

                    //* This user has a booked shift
                    if(shift_by_user && shift_by_user.length > 0){

                      console.log("[📗] The user " + _id + " has a booked shift.");

                      // The system must update the previously created visits
                      // First, verify the conditions in establishment, in time and location
                      // Then, update Visits.
                      // Comparing the checkin hour with the dif (shift_mins - establishment.checkin_max_min)
                      // Get the hour from the booked shift
                      // ! TODO: Revisar la hora y minutos de checkin versus la dif de (shift_date - establ.mins)
                      // let _shift_mins = new Date(shift_by_user.shift_date).getMinutes();
                      // let _checkin_mins = new Date(date).getMinutes();
                      // Verify whether the user is making the checkin max min .i.e 15 mins before the appoinment
                      // if( (_shift_mins - establishment.checkin_max_min) <= _checkin_mins ){

                        let distance_to_establishment = calculateDistance(location.latitude,location.longitude,establishment.location.latitude,establishment.location.longitude);

                        // The user is scanning the code in the allowed range (distance)
                        if(distance_to_establishment <= ALLOWED_DISTANCE){
                          
                          let timetable = await Opening_hours.findById( establishment.id_opening_hours, (err) => err ? e400(err)() : "");

                          const _dayExists = timetable.day.some(day => day == new Date(input_date).getDay());

                          if(_dayExists){
                            
                              // Verify the shift and get the registered Visit
                              Visits.findOneAndUpdate({
                                id_shifts: shift_by_user[0]._id,
                                id_users: _id,
                                visit_made: false
                              },{
                                  checkin_time: input_date,
                                  visit_made: true,
                                  id_establishment: qr_id_establishment,
                                  location: {
                                    latitude: location.latitude, // input values
                                    longitude: location.longitude
                                  }
                                }, (err, visit) => {
                                  if (err) return e400(err)();

                                  if(visit){
                                    // Increment +1 the current affluences in the establishment
                                    Establishment
                                      .findByIdAndUpdate(establishment._id, { current_affluences: establishment.current_affluences+=1}, (err) => err ? e400(err)() : "");

                                    Shift.findByIdAndUpdate(shift_by_user[0]._id, {shift_checked: true}, (err) => err ? e400(err)() : "");
                                  

                                    // Time in minutes to make the checkout -> By definition it should be 1 minute before the slot ends
                                    const timeForCheckout = establishment.slot_size - 1;

                                    console.log("TASK: [⏰] Checkout automatic for visit: " + visit._id + " will start in: " + timeForCheckout + " minutes. ");
                                    let makeCheckout = cron.schedule(`*/${timeForCheckout} * * * *`, () => {
                                      
                                      console.log("TASK: [⏰⏰] Checkout automatic for visit: " + visit._id + " has started.");
                                      
                                      Visits.findById(visit._id, (err, visit) => {
                                        if(err) console.error(err);
                                        if(visit){
                                          console.log("[☝] The visit " + visit._id + " is gonna finish.");
                                          
                                          if(!visit.checkout_time){
                                            
                                            let url_dev = 'http://' + process.env.DB_HOST + ':' + process.env.PORT + '/establishment/checkout';
                                            let url_prod = 'https://' + process.env.DB_HOST + '/establishment/checkout';

                                            let _options_checkout = {
                                              url: process.env.ENV == "production" ? url_prod : url_dev,
                                              method: "PUT",
                                              headers: {
                                              'Authorization': req.headers.authorization
                                              },
                                              form: {
                                                checkout_time : new Date()
                                              }
                                            };

                                            request.put(_options_checkout, (err, response, body) => {
                                              if(err) console.error(err);
                                              if(response && response.statusCode === 200 && typeof body !== "undefined"){
                                                console.log("[✅] Checkout was automatically made.");
                                              }else{
                                                console.error("[❗] Checkout wasn't made.");
                                              }
                                            });

                                            makeCheckout.stop();
                                          }else{
                                            console.log("Visit " + visit._id + " has already finished.");
                                            makeCheckout.stop();
                                          }
                                        }else{
                                          console.log("Visit " + visit._id + " not found");
                                          makeCheckout.stop();
                                        }
                                      });
                                    });

                                    
                                    
                                    return res.json({
                                      success: true,
                                      message: "Visit registered correctly by a booked shift",
                                      date,
                                      visit,
                                      establishment,
                                      checkout_message: "TASK: [⏰] Checkout automatic for visit: " + visit._id + " will start in: " + timeForCheckout + " minutes. "
                                    });
                                  }else{
                                    return e404("NOT_FOUND")("There is not shift to update.");
                                  }
                              });

                          }else{
                            return e400("FAR_AWAY")("The establishment does not open this day.");
                          }
                        }else{
                          return e400("INVALID")("The QR is scanned far away from the establishment.");
                        }
                      // }else{
                        // return e400("INVALID")("The checkin has to be made in a certain period of time.");
                      // }
                    }
                    
                    //* This user does not have a booked shift
                    else{

                      console.log("[❕] The user " + _id + " does not have a booked shift.");
                      
                      // Check if there is space in this slot
                      let shifts_by_slot = await Shift.find({ id_establishment: qr_id_establishment, shift_date: { $gte: new Date(date), $lte: new Date(date).addHours(1) } },(err) => err ? e400(err)() : "");

                      // There is at least one place 
                      if(shifts_by_slot.length < establishment.max_persons_per_slot){

                        let distance_to_establishment = calculateDistance(location.latitude,location.longitude,establishment.location.latitude,establishment.location.longitude);

                        // The user is scanning the code in the allowed range (distance)
                        if(distance_to_establishment <= ALLOWED_DISTANCE){

                          let newShift = new Shift({
                            shift_date: date,
                            shift_code: establishment.location.countryCode + Math.round(Math.random() * 100000).toString(),
                            id_establishment: qr_id_establishment,
                            id_users: _id,
                            shift_checked: true,
                            comments: "Shift_at_establishment_" + establishment.name
                          });

                          newShift.save(err => {
                            if(err) return e400(err)();

                            // Create a new Visit
                            let newVisit = new Visits({
                              checkin_time: date,
                              id_shifts: newShift._id,
                              visit_made: true,
                              id_establishment: qr_id_establishment,
                              id_users: _id,
                              location: {
                                latitude: location.latitude,
                                longitude: location.longitude
                              }
                            });
          
                            newVisit.save((err, visit) => {
                              if (err) return e400(err)();
                              
                              Establishment
                                  .findByIdAndUpdate(establishment._id, { current_affluences: establishment.current_affluences+=1 }, (err) => err ? e400(err) : "");

                              // Time in minutes to make the checkout -> By definition it should be 1 minute before the slot ends
                              const timeForCheckout = establishment.slot_size - 1;

                              console.log("TASK: [⏰] Checkout automatic for visit: " + visit._id + " will start in: " + timeForCheckout + " minutes. ");
                              let makeCheckout = cron.schedule(`*/${timeForCheckout} * * * *`, () => {
                                
                                console.log("TASK: [⏰⏰] Checkout automatic for visit: " + visit._id + " has started.");
                                
                                Visits.findById(visit._id, (err, visit) => {
                                  if(err) console.error(err);
                                  if(visit) {
                                    console.log("[☝] The visit " + visit._id + " is gonna finish.");
                                    
                                    if(!visit.checkout_time){
                                      
                                      let url_dev = 'http://' + process.env.DB_HOST + ':' + process.env.PORT + '/establishment/checkout';
                                      let url_prod = 'https://' + process.env.DB_HOST + '/establishment/checkout';

                                      let _options_checkout = {
                                        url: process.env.ENV == "production" ? url_prod : url_dev,
                                        method: "PUT",
                                        headers: {
                                        'Authorization': req.headers.authorization
                                        },
                                        form: {
                                          checkout_time : new Date()
                                        }
                                      };

                                      request.put(_options_checkout, (err, response, body) => {
                                        if(err) console.error(err);
                                        if(response && response.statusCode === 200 && typeof body !== "undefined"){
                                          console.log("[✅] Checkout was automatically made.");
                                        }else{
                                          console.error("[❗] Checkout wasn't made.");
                                        }
                                      });

                                      makeCheckout.stop();
                                    }else{
                                      console.log("Visit " + visit._id + " has already finished.");
                                      makeCheckout.stop();
                                    }
                                  } else{
                                    console.log("Visit " + visit._id + " not found");
                                    makeCheckout.stop();
                                  }
                                });
                              });

                              return res.json({
                                success: true,
                                message: "Visit registered correctly by a free slot",
                                date,
                                visit,
                                establishment,
                                checkout_message: "TASK: [⏰] Checkout automatic for visit: " + visit._id + " will start in: " + timeForCheckout + " minutes. "
                              });
                            });
                          });

                        } else {
                          return e400("INVALID_LOCATION")("This location is far from the establishment.");
                        }
                      }else{
                        // There is not more places
                        return e400("INVALID_FULL")("There is not place at this slot. The user must create another shift.");
                      }
                    }
                  }else{
                    return e404("NOT_FOUND")("The establishment is undefined.");
                  }
                });
              } else {
                // QR undefined
                return e404("NOT_FOUND")("QR code undefined.");
              }
            });
        }else{
          // QR expired
          return e400("INVALID")("QR code expired");
        }
      }
    )
  }
)





/**
 * @route   POST /establishment/checkin-owner
 * @desc    It allows the establishment to make checkin for one user
 * 
 * @body   {String}  shift_code 
 * @private
 */
router.post("/checkin-owner", passport.authenticate(["jwt", "google", "facebook"], { session: false}), async (req,res) => {

  const { presetE400, presetE404 } = errorGenerator(res);
  let { type } = await req.user;

  if(/user/ig.test(type)) return res.status(401).send("Unauthorized");

  let { shift_code } = req.body;

  Shift.findOne({ shift_code }, async (err, shift) => {
    if (err) return presetE400(err);

    if(shift){

      let establishment = await Establishment.findOne({ _id: shift.id_establishment, isActive: true  }, (err) => err ? e400(err)() : "");
      
      if(establishment){
        // Verify the shift and get the registered Visit
        Visits.findOneAndUpdate(
          { 
            id_shifts: shift._id,
            id_users: shift.id_users
          }, 
          {
            checkin_time: new Date(),
            visit_made: true,
            id_establishment: establishment._id,
          }, (err, visit) => {
            if (err) return e400(err)();

            // Increment +1 the current affluences in the establishment
            Establishment
              .findByIdAndUpdate(establishment._id, { current_affluences: establishment.current_affluences+=1 }, (err) => err ? e400(err)() : "");

            Shift
              .findByIdAndUpdate(shift._id, { shift_checked: true }, (err) => err ? e400("INVALID")() : "");

            // Time in minutes to make the checkout -> By definition it should be 1 minute before the slot ends
            const timeForCheckout = (establishment.slot_size - 1);

            console.log("TASK: [⏰] Checkout automatic for visit: " + visit._id + " will start in: " + timeForCheckout + " minutes. ");
            let makeCheckout = cron.schedule(`*/${timeForCheckout} * * * *`, () => {
              
              console.log("TASK: [⏰⏰] Checkout automatic for visit: " + visit._id + " has started.");
              
              Visits.findById(visit._id, (err, visit) => {
                if(err) console.error(err);
                if(visit){
                  console.log("[☝] The visit " + visit._id + " is gonna finish.");
                  
                  if(!visit.checkout_time){
                    
                    let url_dev = 'http://' + process.env.DB_HOST + ':' + process.env.PORT + '/establishment/checkout-owner';
                    let url_prod = 'https://' + process.env.DB_HOST + '/establishment/checkout-owner';

                    let _options_checkout = {
                      url: process.env.ENV == "production" ? url_prod : url_dev,
                      method: "PUT",
                      headers: {
                      'Authorization': req.headers.authorization
                      },
                      form: {
                        shift_code
                      }
                    };

                    request.put(_options_checkout, (err, response, body) => {
                      if(err) console.error(err);
                      if(response && response.statusCode === 200 && typeof body !== "undefined"){
                        console.log("[✅] Checkout was automatically made.");
                      }else{
                        console.error("[❗] Checkout wasn't made.");
                      }
                    });

                    makeCheckout.stop();
                  }else{
                    console.log("Visit " + visit._id + " has already finished.");
                    makeCheckout.stop();
                  }
                }else{
                  console.log("Visit " + visit._id + " not found");
                  makeCheckout.stop();
                }
              });
            });

            return res.json({
              success: true,
              message: "Visit registered correctly by a booked shift",
              date : new Date(),
              visit,
              establishment,
              checkout_message: "TASK: [⏰] Checkout automatic for visit: " + visit._id + " will start in: " + timeForCheckout + " minutes. "
            });
        });
      }else {
        return presetE404("Establishment not found");
      }
    }else {
      return presetE404("Shift not found");
    }
  });
});









/**
 * @route   POST /establishment/checkin-code
 * @desc    It allows the user to checkin by a shift code
 * 
 * @body   {String}  shift_code 
 * @body   {Date}  date i.e timestamp 
 * @body   {String}  location { latitude : 1.111, longitude: 1.111 } 
 * @private
 */
router.post("/checkin-code", passport.authenticate(["jwt", "google", "facebook"], { session: false}), async (req,res) => {
  const { e400, e404, presetE400 } = errorGenerator(res);

  let { _id } = await req.user;

  const ALLOWED_DISTANCE = 100; // meters

  const {shift_code, date, location } = req.body;
  if(!shift_code || !date || !location) return presetE400();
  if(typeof date == "string") return presetE400();

  Shift.findOne({ shift_code, shift_checked: false }, async (err, shift) => {
    if(err) return e400(err)();

    if(shift){

      let establishment = await Establishment.findOne({ _id: shift.id_establishment, isActive: true  }, (err) => err ? e400(err)() : "");
      
      if(establishment){

        //* Check max number of affluences
        // The current people number must to be lower than the establishment's capacity
        if(establishment.current_affluences >= establishment.max_affluences_allowed){
          return e400("INVALID_FULL")("People inside is over the maximum allowed.");
        }

        // The system must update the previously created visits
        // First, verify the conditions in establishment, in time and location
        // Then, update Visits.
        // Comparing the checkin hour with the dif (shift_mins - establishment.checkin_max_min)
        // Get the hour from the booked shift
        let _shift_mins = new Date(shift.shift_date).getMinutes();
        let _checkin_mins = new Date(date).getMinutes();

        // TODO: Verify whether the user is making the checkin max min .i.e 15 mins before the appoinment
        // if( (_shift_mins - establishment.checkin_max_min) <= _checkin_mins ){

          let distance_to_establishment = calculateDistance(location.latitude,location.longitude,establishment.location.latitude,establishment.location.longitude);

          // The user is scanning the code in the allowed range (distance)
          if(distance_to_establishment <= ALLOWED_DISTANCE){
            
            // Verify the shift and get the registered Visit
            Visits.findOneAndUpdate(
              { 
                id_shifts: shift._id,
                id_users: _id
              }, 
              {
                checkin_time: date,
                visit_made: true,
                id_establishment: establishment._id,
                location: {
                  latitude: location.latitude, // input values
                  longitude: location.longitude
                }
              }, (err, visit) => {
                if (err) return e400(err)();

                // Increment +1 the current affluences in the establishment
                Establishment
                  .findByIdAndUpdate(establishment._id, { current_affluences: establishment.current_affluences+=1 }, (err) => err ? e400(err)() : "");

                Shift
                  .findByIdAndUpdate(shift._id, { shift_checked: true }, (err) => err ? e400("INVALID")() : "");


                // Time in minutes to make the checkout -> By definition it should be 1 minute before the slot ends
                const timeForCheckout = establishment.slot_size - 1;

                console.log("TASK: [⏰] Checkout automatic for visit: " + visit._id + " will start in: " + timeForCheckout + " minutes. ");
                let makeCheckout = cron.schedule(`*/${timeForCheckout} * * * *`, () => {
                  
                  console.log("TASK: [⏰⏰] Checkout automatic for visit: " + visit._id + " has started.");
                  
                  Visits.findById(visit._id, (err, visit) => {
                    if(err) console.error(err);
                    if(visit){
                      console.log("[☝] The visit " + visit._id + " is gonna finish.");
                      
                      if(!visit.checkout_time){
                        
                        let url_dev = 'http://' + process.env.DB_HOST + ':' + process.env.PORT + '/establishment/checkout-owner';
                        let url_prod = 'https://' + process.env.DB_HOST + '/establishment/checkout-owner';

                        let _options_checkout = {
                          url: process.env.ENV == "production" ? url_prod : url_dev,
                          method: "PUT",
                          headers: {
                          'Authorization': req.headers.authorization
                          },
                          form: {
                            shift_code
                          }
                        };

                        request.put(_options_checkout, (err, response, body) => {
                          if(err) console.error(err);
                          if(response && response.statusCode === 200 && typeof body !== "undefined"){
                            console.log("[✅] Checkout was automatically made.");
                          }else{
                            console.error("[❗] Checkout wasn't made.");
                          }
                        });

                        makeCheckout.stop();
                      }else{
                        console.log("Visit " + visit._id + " has already finished.");
                        makeCheckout.stop();
                      }
                    }else{
                      console.log("Visit " + visit._id + " not found");
                      makeCheckout.stop();
                    }
                  });
                });

                return res.json({
                  success: true,
                  message: "Visit registered correctly by a booked shift",
                  date,
                  visit,
                  establishment
                });
            });


          }else{
            // Qrcode scanned far away
            return presetE400();
          }
        // }
        // else{
        //   return e400("INVALID")("This time is out of the allowed checkin time.");
        // }
      }else{
        return e400("NOT_FOUND")("Establishment undefined.");
      }
    }else{
      return e404("NOT_FOUND")("Shift not found.");
    }

  });

});




/**
 * @route   PUT /establishment/checkout
 * @desc    It allows the user to checkout
 * @private
 */
router.put('/checkout', passport.authenticate(["jwt", "google", "facebook"], { session: false }) , async (req, res, next) => {

  const { e404, presetE400, e400 } = errorGenerator(res);
  // We count a number of hours when the user made the checkin
  // We defined an slot about 2 hour(s) to verify whether the user made the checkout
  const HOURS_IN_PAST = 2;

  console.log("[🔧] Starting checkout service...");

  let { _id } = await req.user;

  if(!_id) return presetE400();

  let hours_ago = new Date().addHours(-HOURS_IN_PAST);
  
  // It is important to compare in the DB and get all the shifts which exist in the created range i.e 1 hour in the past (from now)
  Visits.findOneAndUpdate({ id_users: _id, checkin_time: { $gte : hours_ago } }, {checkout_time: new Date() }, (err, visit) => {
    if(err) return e400(err)();

    if(visit){
      // Current visitor
      Establishment.findById(visit.id_establishment, (err, establishment) => {
        if(err) return e400(err)();

        if(establishment){
          if(establishment.current_affluences > 0){
            Establishment.findByIdAndUpdate(establishment._id, { current_affluences: establishment.current_affluences-=1 }, (err) => err ? e400(err)() : "");
          }
          
          Shift.findByIdAndUpdate(visit.id_shifts, { shift_checked_out: true }, (err) => err ? e400(err)() : "");

          res.json({
            success: true,
            message: "Checkout successfully made",
            visit
          });

        }else{
          return e404("NOT_FOUND")("Establishment not found");
        }
      });
    }else{
      return e404("NOT FOUND")("Visit not found");
    }
  });
});



/**
 * @route   PUT /establishment/checkout-owner
 * @desc    It allows the establishment to make checkout for one user
 * 
 * @body   {String}  shift_code 
 * @private
 */
router.put("/checkout-owner", passport.authenticate(["jwt", "google", "facebook"], { session: false}), async (req,res) => {
  
  console.log("[🔧] Starting checkout service...");

  const { presetE400, presetE404 } = errorGenerator(res);
  let { shift_code } = req.body;

  if(typeof shift_code == "undefined" || !shift_code) return presetE400();
 
  Shift.findOne({ shift_code }, async (err, shift) => {
    if (err) return presetE400(err);

    if(shift){
      
      let establishment = await Establishment.findOne({ _id: shift.id_establishment, isActive: true  }, (err) => err ? e400(err)() : "");
      
      if(establishment){
        // Verify the shift and get the registered Visit
        Visits.findOneAndUpdate(
          { 
            id_shifts: shift._id,
            id_users: shift.id_users
          }, 
          {
            checkout_time: new Date() 
          }, (err, visit) => {
            if (err) return e400(err)();

            if(establishment.current_affluences > 0){
              Establishment.findByIdAndUpdate(establishment._id, { current_affluences: establishment.current_affluences-=1 }, (err) => err ? e400(err)() : "");
            }

            Shift.findByIdAndUpdate(shift._id, { shift_checked_out: true }, (err) => err ? e400(err)() : "");

            return res.json({
              success: true,
              message: "Checkout successfully made",
              visit
            });
        });
      }else {
        return presetE404("Establishment not found");
      }
    }else {
      return presetE404("Shift not found");
    }
  });
});



module.exports = router;
