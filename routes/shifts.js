const express = require('express');
const router = express.Router();
const request = require('request');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");
var cron = require('node-cron');

// Keys
const { mapQuestAPIKey } = require("../config/keys");

// Models
const Shift = require("../models/Shifts");
const Visits = require("../models/Visits");
const Users = require("../models/Users");
const Category = require("../models/Category");
const Opening_hours = require("../models/Opening_hours");
const Establishment = require("../models/Establishment");
const ShiftMessage = require("../models/ShiftMessage");

// Utils
const { toTimestamp, normalizeData, sendConfirmationEmail, isValidDate, getTimeSlotsPerDay } = require("../utils/utils");
const { errorGenerator } = require("../utils/curries")

// Helpers
Date.prototype.addDays = function (days) {
	var date = new Date(this.valueOf());
	date.setDate(date.getDate() + days);
	return date;
};

Date.prototype.addHours= function(h){
    this.setHours(this.getHours()+h);
    return this;
};

Date.prototype.addMinutes= function(m){
    this.setMinutes(this.getMinutes() + m);
    return this;
};

Date.prototype.restMinutes = function(m){
    this.setMinutes(this.getMinutes() - m);
    return this;
}


/**
 * @route   GET /shifts/params
 * @desc    Gives the params available to the client
 * @todo    Store the values in a correct DB
 * @public
 */
router.get("/params", (_, res) => {
    res.json({
        name: "shifts_params",
        params: []
    })
});

/**
 * @route   GET /shifts/
 * @desc    Get all the shifts for specific establishment
 * @param   {String} id_establishment
 * @private
 */
router.get("/", passport.authenticate(["jwt", "google", "facebook"], { session: false }), (req, res) => {

    let { id_establishment } = req.query;

    if(!id_establishment) return res.status(400).json({ error: "Missing argument id_establishment."});

    Establishment
        .findOne( { _id: id_establishment}, (err, establishment) => {
            if(err) return res.status(400).json(err);

            if(establishment){
                Shift
                    .find({id_establishment})
                    .sort({ shift_date: -1 }) // Filtering from the most recent
                    .exec((err, shifts) => {
                        if(err) return res.status(400).json(err);

                        let availableShifts = Promise.all(shifts.map(async shift => {
                            let _shift = {};

                            let user = await Users.findById(shift.id_users, (err) => err ? e400(err)() : "" );
                            let shiftMessages = await ShiftMessage.find({ id_shift: shift._id } , (err) => err ? e400(err)() : "");

                            _shift._id = shift._id;
                            _shift.shift_date = shift.shift_date;
                            _shift.shift_code = shift.shift_code;
                            _shift.comments = shift.comments;
                            _shift.shift_checked = shift.shift_checked;
                            _shift.shift_checked_out = shift.shift_checked_out;
                            _shift.num_people_shift = shift.num_people_shift;
                            _shift.created_at = shift.created_at || null;
                            _shift.updated_at = shift.updated_at || null;
                            _shift.user = {
                                _id : user._id,
                                name: user.name,
                                profile_pic_url : user.profile_pic_url,
                                email: user.email,
                                document: user.document,
                                country: user.country,
                                type: user.type
                            }
                            _shift.shiftMessages = shiftMessages;
                            
                            return _shift;
                        }));

                        availableShifts
                            .then(shifts => {

                                // This is for show the user the last time he/she visited the service
                                // After he/she ask for the service
                                // This code updates the last time the user saw the SHIFTS
                                const timeForUpdateLatestView = 1;

                                console.log("TASK Shifts: [⏰] Update last view for Store: " + id_establishment + " will start in: " + timeForUpdateLatestView + " minutes.");
                                let lastViewOrder = cron.schedule(`*/${timeForUpdateLatestView} * * * *`, () => {
                                    console.log("TASK Shifts: [⏰⏰] Update last view for Store: " + id_establishment + " has started.");

                                    Establishment.findByIdAndUpdate(id_establishment, { shifts_checked_at: new Date() }, (err, _) => {
                                        if (err) return e400(err)();
                                        console.log("TASK Shifts: [✅] Last Order view for Store: " + id_establishment + " has been updated.");
                                        lastViewOrder.destroy();
                                    });
                                });

                                return res.json({
                                    success: true,
                                    total: shifts.length,
                                    establishment: {
                                        _id: id_establishment,
                                        name: establishment.name,
                                        phone: establishment.phone,
                                        description: establishment.description,
                                        shifts_checked_at : establishment.shifts_checked_at || null,
                                        orders_checked_at : establishment.orders_checked_at || null
                                    },
                                    shifts
                                });
                            })
                        
                });
            }else{
                return res.status(404).json({
                    success: false,
                    message: "There is not establishment"
                });
            }
        });
});



/**
 * @route   GET /shifts/get-by-date/
 * @desc    Get a list of shifts for an given establishment and date
 * @param   {String} id_establishment
 * @param   {Date} date i.e timestamp
 * @example {{root}}/shifts/get-by-date/?id_establishment=XXXX&date=15242135464
 * @private
 */
router.get("/get-by-date", passport.authenticate(["jwt", "google", "facebook"], { session: false }), async (req,res) => {
    let { e400, presetE400, e404 } = errorGenerator(res);

    let { _id, type } = await req.user;
    let { id_establishment, date } = req.query;
    if(!id_establishment || !date) return presetE400();

    Establishment
        .findById( id_establishment, async (err, establishment) => {
            if(err) return e400(err)();

            if(establishment){
                
                let input_date = parseInt(date);
                if(!input_date) return e400("INVALID_DATE")("The date must be in timestamp");
               
                let timetable = await Opening_hours.findById( establishment.id_opening_hours, (err) => err ? e400(err)() : "");

                let end_date = new Date().addHours(establishment.shift_schedule_max_hours); // From now until XX days max
                    
                // Checking if the day exists in the opening days
                const _dayExists = timetable.day.some(day => day == new Date(input_date).getDay());

                if(_dayExists){

                    // Getthing the opening and closing hours, Only taking the HH and MM
                    // With the date info from the Input.

                    let open_hour = new Date(timetable.open_hour).setDate(new Date(input_date).getDate());
                    let close_hour = new Date(timetable.close_hour).setDate(new Date(input_date).getDate());

                    Shift
                        .find({
                            id_establishment,
                            shift_date: { $gte: open_hour, $lte: close_hour }
                        }, (err, shifts) => {
                            if(err) return e400(err)();

                            let SLOT_TIME = establishment.slot_size || 30; // min

                            // The today variable stores the asked day
                            let today = new Date(input_date);
                            let lastDay = new Date(input_date);
                            lastDay.setDate(today.getDate() + 1); // Until the end of the day
                            
                            let hours = [];
                            // Getting the slot
                            for (let i = new Date(today); i < lastDay; i.setDate(i.getDate() + 1)) {
                                hours = getTimeSlotsPerDay(i,timetable,SLOT_TIME).map(h => h.toLocaleTimeString());
                            }
    
                            let output_slots = hours.map((hour,index) => {
                                let shifts_without_user = shifts.filter(shift => new Date(shift.shift_date).toLocaleTimeString() == hour && !new RegExp(shift.id_users, "ig").test(_id));
                                let shifts_with_user = shifts.filter(shift => new Date(shift.shift_date).toLocaleTimeString() == hour);

                                let slot = {};
                                let next_hour = (hours[index + 1]) || (new Date(timetable.close_hour).toLocaleTimeString("en-US",{hour12: true}));
                                
                                slot.slot_number = index;
                                slot.slot_hours = hour + " - " + next_hour;
                                slot.slot_hour_start = hour;
                                slot.slot_hour_end = next_hour;
                                slot.total_shifts = establishment.max_persons_per_slot;
                                slot.shifts = shifts_without_user;
                                slot.taken_shifts = shifts_with_user.length;
                                slot.remaining_shifts = establishment.max_persons_per_slot - shifts_with_user.length;
                                // Check when the total shifts are lower to taken (when the user has another shift at the same slot)
                                slot.available = slot.taken_shifts >= slot.total_shifts || slot.shifts.length < slot.taken_shifts ? false : true;
                                
                                return slot;
                            });

                            // Remove the last slot to prevent books in the last hour
                            output_slots.pop();

                            res.json({
                                success: true,
                                total: shifts.length ,
                                date: new Date(input_date).toUTCString(),
                                slot_size: SLOT_TIME,
                                slot_size_format: "minutes",
                                slots_totaL: hours.length - 1,
                                slots: output_slots,
                                time_format: "HH:MM:SS"
                            });
                    });
                }else{
                    return e400("INVALID_DATE")("The establishment is closed this day.");
                }
            }else{
                return e404("NOT_FOUND")("Establishment not found.")
            }
        });
});



/**
 * @route   GET /shifts/get-by-userid/
 * @desc    Get a list of shifts for an given user
 * @private
 */
router.get("/get-by-userid", passport.authenticate(["jwt", "google", "facebook"], { session: false }), async (req,res) => {

    let { _id,type} = await req.user;
    const { e400,presetE500 } = errorGenerator(res);

    if(/owner/ig.test(type)) return res.status(401).send("Unauthorized");

    // Generating a new date to calculate the search
    // Starting from today at midnight until the last shift_date found
    let year = new Date().getFullYear();
    let month = new Date().getMonth();
    let day = new Date().getDate();

    let input_date = new Date(year,month,day,0,0,0,0);

    Shift
        .find({ id_users: _id, shift_date: { $gte: input_date } })
        .sort({ shift_date: -1 }) // Filtering from the most recent
        .exec((err, shifts) => {

        if(err) return e400(err)();

        let all_shifts = Promise.all(shifts.map(async shift => {
            
            let establishment = await Establishment.findById(shift.id_establishment, (err) => err ? e400(err)() : "");
            
            if(establishment){

                let category = await Category.findById(establishment.id_category, (err) => err ? e400(err)() : "");
                let visit = await Visits.findOne({ id_shifts: shift._id }, (err) => err ? e400(err)() : "");
                let opening_hours = await Opening_hours.findById(establishment.id_opening_hours, (err) => err ? e400(err)() : "");
                let shiftMessages = await ShiftMessage.find({ id_shift: shift._id } , (err) => err ? e400(err)() : "");
          
                let _my_shift = {};

                _my_shift._id = shift._id;
                _my_shift.shift_code = shift.shift_code;
                _my_shift.shift_date = shift.shift_date;
                _my_shift.shift_date_string = new Date(shift.shift_date).toLocaleString();
                _my_shift.shift_checked = visit.visit_made ? true : false;
                _my_shift.shift_checked_out = shift.shift_checked_out || false;
                _my_shift.num_people_shift = shift.num_people_shift || 0;
                _my_shift.comments = shift.comments;
                _my_shift.shiftMessages = shiftMessages;

                _my_shift.establishment = {
                    _id: establishment._id,
                    name: establishment.name,
                    category: category ? category.name : "",
                    phone: establishment.phone,
                    description: establishment.description,
                    shift_attention_mins: establishment.shift_attention_mins,
                    shift_schedule_max_hours: establishment.shift_schedule_max_hours,
                    max_shifts: establishment.max_shifts,
                    establishment_pics_url : establishment.establishment_pics_url || [],
                    num_per_shift : establishment.num_per_shift || null,
                    enable_num_people : establishment.enable_num_people || false,
                    slot_size: establishment.slot_size || 30,
                    enableShifting : establishment.enableShifting,
                    shifts_checked_at : establishment.shifts_checked_at || null,
                    orders_checked_at : establishment.orders_checked_at || null,
                    opening_hours,
                    location: establishment.location
                };

                return _my_shift;
            }
            
        }));

        all_shifts
            .then(shifts => {
                return res.json({
                    success:true,
                    user_id: _id,
                    total: shifts.length,
                    shifts : shifts.filter(shift => shift)
                });
            })
            .catch(presetE500);
    });
});




 /**
  * @route      POST /shifts/new
  * @desc       Create a new shift
  * @param      {Date} shift_date TimeEpoch or timestamp date i.e 1588696824118
  * @param      {String} comments
  * @param      {String} id_establishment
  * @param      {String} id_users User's id by Bearer token
  * @private
  */
router.post("/new", passport.authenticate(["jwt", "google", "facebook"], { session: false }), async (req,res) => {
    const { e400, presetE400, e404 } = errorGenerator(res);
    //? this should be middleware
    if(typeof req.body != "object") return presetE400();

    let {
        shift_date,
        id_establishment,
        document,
        num_people_shift
    } = req.body;
    
    let { _id, email } = await req.user;

    let id_users = _id;
    if(!shift_date || !id_establishment) return presetE400();

    // Check that the establishment exists before add a new Shift
    Establishment
        .findById( id_establishment, (err, establishment) => {
            if(err) return e400(err)();

            if(establishment){

                // Check all the available shifts
                // 1. Check that the input date exists in the timetable that means, the establishment has service that day
                // 2. Check that the maximum time to book a shift is lower than the time given by the owner
                
                Opening_hours.findById( establishment.id_opening_hours, (err, timetable) => {
                    if(err) return e400(err)();

                    let end_date = new Date().addHours(establishment.shift_schedule_max_hours); // From now until XX days max
                    let input_date = new Date(shift_date);
                    
                    //if(input_date < new Date()) return e400("INVALID_DATE")("The input date is in the past.");
                    if( !isValidDate(input_date) ) return e400("INVALID_DATE")("Invalid date");

                    // Checking if the day exists in the opening days
                    const _dayExists = timetable.day.some(day => day == input_date.getDay());

                    if(_dayExists && (toTimestamp(end_date) - shift_date) > 0 ){

                        // Then, we have 2 dates (input) and (close_date)
                        // But I need to rebuild close_date because it was created in other day, Only taking the HH and MM
                        // With the date info from the Input.

                        // From Input
                        const _yearInput = new Date(shift_date).getFullYear();
                        const _monthInput = new Date(shift_date).getMonth();
                        const _dayInput = new Date(shift_date).getDate();
                        const _hourInput = input_date.getHours(); // ! Important: Keep the hours local time
                        // From DB
                        let input_slot = new Date(_yearInput,_monthInput,_dayInput,_hourInput,0,0,0);

                        let close_hour = new Date(timetable.close_hour).setDate(new Date(input_date).getDate());

                        // TODO Check for minutes and compare i.e the establishment closes at 20:45, and the user asks for 20:15
                        // Then, I get the shifts for this establishment and from now until the establishment closes
                        Shift.find({ 
                                id_establishment,
                                shift_date: { $gte: input_slot , $lte: close_hour }
                            }, async (err, shifts) => {
                                if(err) return e400(err)();

                                // Only in the same hour <- Slots by Hour
                                // TODO: Change it to half hour
                                let shifts_same_hour = shifts.filter(shift => new Date(shift.shift_date).getUTCHours() == input_date.getUTCHours());
                                const maximum_capacity_persons_hour = Math.round(establishment.max_persons_per_slot * normalizeData(establishment.max_shifts)); 
                                if(shifts_same_hour.length < maximum_capacity_persons_hour){
                                    
                                    // Checks if the same user has created another appoinment for this period of time
                                    Users.findOne({ _id: id_users }, (err, user) => {
                                        if(err) return e400(err)();
                                        if(user){
                                            const user_already_created_shift = shifts_same_hour.some(shift => new RegExp(shift.id_users,"ig").test(user._id));
                                            if(user_already_created_shift){
                                                return e400("INVALID_FULL")("This user already has a shift in this slot");
                                            }else{

                                                if (document) {
                                                    Users.findOneAndUpdate({ _id: id_users }, {document} , (err) => err ? e400(err)() : "");
                                                }
                                                
                                                createNewShift({_id, email}, req,res, shifts_same_hour.length, maximum_capacity_persons_hour,establishment,input_date);
                                            }
                                        }else{
                                            return e404("NOT_FOUND")("This user does not exist.");
                                        }
                                    });    
                                }else{
                                    return e400("INVALID_FULL")("This slot has already taken. Check the availability.");
                                }
                            });
                    }else{
                        return e400("INVALID_DATE")("The input date is over the shift_schedule_max_hours.");
                    }
                });
            } else{
                return e404("NOT_FOUND")("The establishment was not found.");
            }

        });
});


/**
 * Store the shift in MongoDB 
 * @param {Object} user 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Number} current Current number of persons per slot
 * @param {Number} maximum Maximum number of persons per slot
 * @private
 */
const createNewShift = async (user, req, res, current, maximum,establishment, input_date = Date.now()) => {

    const { e400 } = errorGenerator(res);

    let { _id,type} = await req.user;

    let {
        comments,
        id_establishment,
        document,
        num_people_shift
    } = req.body;

    let shift_code = establishment.location.countryCode + Math.round(Math.random() * 100000).toString();

    let newShift = new Shift({
        shift_date: input_date,
        comments,
        id_users: user._id,
        id_establishment,
        shift_code,
        num_people_shift
    });

    newShift.save(err => {
        if(err) return e400(err)();

        let newShiftMessage = new ShiftMessage({
            id_establishment,
            id_users: user._id,
            id_shift: newShift._id,
            conversation: [
                {
                  sender: _id,
                  senderType: type,
                  text: comments
                }
            ]
        });

        newShiftMessage.save(err => err ? e400(err)() : "");

        let newVisit = new Visits({
            id_shifts : newShift._id,
            id_establishment,
            id_users: user._id
        });

        newVisit.save(err => {
            if(err) return e400(err)();

            let subjectEmail = `Your shift ${shift_code}  with Confflux was created!`;
            let descritionEmail = `Thank you for booking with Confflux.
                Your Shift details: 
                - Shift code ${shift_code}
                - Establishment ${establishment.name}
                - City ${establishment.location.city}
                - Date ${new Date(newShift.shift_date).toLocaleString()}
                `;

            sendConfirmationEmail({ email: user.email, subject: subjectEmail, description: descritionEmail });

            res.json({
                success: true,
                message: "Shift booked correctly",
                user_id: user._id,
                shift: {
                    _id: newShift._id,
                    shift_code: newShift.shift_code,
                    shift_date: Date.parse(newShift.shift_date),
                    shift_date_string: new Date(newShift.shift_date).toLocaleString(),
                    comments: newShift.comments
                },
                visit: {
                    id: newVisit._id
                },
                newShiftMessage: {
                    id: newShiftMessage._id
                },
                remaining: Math.round(maximum - current)
            });
        });
    });
}



/**
 * @route   GET /shifts/get-by-id/
 * @desc    Get the information of a shift given an id
 * @param   {String} id Shift's id
 * @example /shifts/shift-by-id/?id=MY_ID
 * @example /shifts/shift-by-id/?MY_ID
 * @private
 */
router.get("/get-by-id", passport.authenticate(["jwt", "google", "facebook"], { session: false }), (req,res) => {
    let { id } = req.query || req.params;

    if(!id) return res.status(400).json({ error: "Missing argument id."});

    Shift.findById(id, async (err, shift) => {
        if(err) return res.status(400).json(err);

        if(shift){

            let shiftMessages = await ShiftMessage.find({ id_shift: shift._id } , (err) => err ? e400(err)() : "");
            let user = await Users.findById(shift.id_users, (err) => err ? e400(err)() : "" );
            let establishment = await Establishment.findById(shift.id_establishment, (err) => err ? e400(err)() : "");

            let output_shifts = {};
            output_shifts.id = shift._id;
            output_shifts.shift_date = shift.shift_date;
            output_shifts.shift_date_timestamp = toTimestamp(shift.shift_date);
            output_shifts.comments = shift.comments;
            output_shifts.id_users = shift.id_users;
            output_shifts.num_people_shift = shift.num_people_shift || 0;
            output_shifts.shiftMessages = shiftMessages;

            if(establishment){
                let output_establishment = {};
                output_establishment.id = establishment._id;
                output_establishment.name = establishment.name;
                output_establishment.description = establishment.description;
                output_establishment.establishment_pics_url = establishment.establishment_pics_url || [];
                output_establishment.shifts_checked_at = establishment.shifts_checked_at || null;
                output_establishment.orders_checked_at = establishment.orders_checked_at || null;
                output_shifts.establishment = output_establishment;
            }

            if (user) {
                let output_user = {};
                output_user.id = user._id;
                output_user.name = user.name;
                output_user.email = user.email;
                output_user.document = user.document;

                output_shifts.user = output_user;
            }

            res.json({
                success: true,
                shift: output_shifts
            });

        } else{
            return res.status(404).json({
                success: false,
                message: "This shift does not exist"
            });
        }
    });

});






/**
 * @route   POST /shifts/chat-owner
 * @desc    Post a new message from the Owner to the User
 * @param   {String} id Shift id
 * @body    {String} message
 * @private
 */
router.post("/chat-owner",  passport.authenticate(["jwt", "google", "facebook"], { session: false }), async (req,res) => {

    const { e400, presetE400, presetE404 } = errorGenerator(res);
    let { id } = req.query;
    let { message } = req.body;
    
    let { _id, type } = await req.user;
    if(!_id || !type || !message || !id ) return presetE400();
  
    if(/user/ig.test(type)) return res.status(401).send("Unauthorized");
  
    ShiftMessage
      .findOne({ id_shift: id },(err, shiftMessage) => {
        if (err) return e400(err)();
  
        if(shiftMessage){
  
          let newMessage = {
            sender: _id,
            senderType: type,
            text: message
          };
  
          let newConversation = [];
  
          shiftMessage.conversation.map(_message => {
            newConversation.push(_message);
          });
  
          newConversation.push(newMessage);
  
          ShiftMessage
            .findByIdAndUpdate( shiftMessage._id, { conversation : newConversation }, (err, shiftMessage) => {
              if(err) return e400(err)();
  
              res.json({
                success: true,
                shiftMessage
              });
  
            });
        }else{
          return presetE404("ShiftMessages not found");
        }
  
      });
  });
  
  
  
  /**
   * @route   POST /shifts/chat-user
   * @desc    Post a new message from the User to the Owner
   * @param   {String} id Shift id
   * @body    {String} message
   * @private
   */
  router.post("/chat-user",  passport.authenticate(["jwt", "google", "facebook"], { session: false }), async (req,res) => {
  
    const { e400, presetE400, presetE404, e404 } = errorGenerator(res);
    let { id } = req.query;
    let { message } = req.body;
    
    let { _id, type } = await req.user;
    if(!_id || !type || !message || !id ) return presetE400();
  
    if(/owner/ig.test(type)) return res.status(401).send("Unauthorized");
  
    ShiftMessage
      .findOne({ id_shift: id },(err, shiftMessage) => {
        if (err) return e400(err)();
  
        if(shiftMessage){
  
          let newMessage = {
            sender: _id,
            senderType: type,
            text: message
          };
  
          let newConversation = [];
  
          shiftMessage.conversation.map(_message => {
            newConversation.push(_message);
          });
  
          newConversation.push(newMessage);
  
          ShiftMessage
            .findByIdAndUpdate( shiftMessage._id, { conversation : newConversation }, (err, shiftMessage) => {
              if(err) return e400(err)();
  
              res.json({
                success: true,
                shiftMessage
              });
  
            });
        }else{
          return presetE404("shiftMessage not found");
        }
  
      });
  });
  









/**
 * @route   PUT /shifts/update
 * @desc    Update one shift by its id
 * @param   {String} id Shift's id
 * @body    {Any} any Parameter to modify
 * @example {{root}}/shifts/update/?id=XXXXXXX --data '{shift_date: new_date, comments: new_comment}'
 * @private
 */
router.put("/update",passport.authenticate(["jwt", "google", "facebook"], { session: false }),(req,res) => {
    let { id } = req.query;
    const { presetE400, e400, e404 } = errorGenerator(res);

    if(!id) return presetE400();

    // The front send me back the number of hours on this day 
    // By default the hours are 00:00
    // With for example shift_hout=7 the change becomes 00:00 += 07:00
    let { shift_hour } = req.body;
    if(!shift_hour) shift_hour = 0;
    if(req.body.shift_date){
        req.body.shift_date = new Date(req.body.shift_date).addHours(shift_hour);
    }
    
    // Only update non-taked shifts
    Shift.findOneAndUpdate({_id: id, shift_date: { $gte: new Date() } }, req.body, async (err, shift) => {
        if(err) return e400(err)();
        if(shift){
            let establishment = await Establishment.findById(shift.id_establishment, (err) => err ? res.status(400).json(err) : "");
            
            if(establishment){
                let end_date = new Date().addHours(establishment.shift_schedule_max_hours);

                let updatedShiftDate = false, updatedShiftComments = false;
                if(req.body.shift_date){
                    // Check if the new date is in the past
                    if(toTimestamp(new Date()) > req.body.shift_date){
                        return e400("EXPIRED_DATE")("It is not possible to update to a date in the past.");
                    }
                    // Or over the maximum time allowed
                    if(toTimestamp(req.body.shift_date) > toTimestamp(end_date)){
                        return e400("WRONG_DATE")("This date is over the maximum time allowed.")
                    }
                    updatedShiftDate = true;
                }
                if(req.body.comments) {
                    updatedShiftComments = true;
                }

                if(updatedShiftDate || updatedShiftComments){
                    return res.json({
                        success: true,
                        message: "Shift successfully updated",
                        info_updated: req.body
                    });
                }else{
                    return e400("NOT_UPDATED")("SHIFT NOT UPDATED");
                }
            }else{
                return e404("NOT_FOUND")("ESTABLISHMENT NOT FOUND");
            }
        }else{
            return e404("NOT_FOUND")("SHIFT NOT FOUND");
        }
    });

});



/**
 * @route   DELETE /shifts/update
 * @desc    Delete one shift by its id
 * @param   {String} id Shift's id
 * @example {{root}}/shifts/update/?id=XXXXXXX
 * @private
 */
router.delete("/remove", passport.authenticate(["jwt", "google", "facebook"], {session: false}), (req,res) => {
    let { id } = req.query;

    if(!id) return res.status(400).json({ error: "Missing argument id."});
    
    Shift.findByIdAndDelete(id, (err, result) => {
        if(err) return res.status(400).json(err);
        
        if(result){
            res.json({
                success: true,
                message: "Shift successfully removed",
                shift_removed: result
            });
        }else{
            return res.status(404).json({
                success: false,
                message: "This shift does not exist"
            });
        }
        
    });
});


module.exports = router;
