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
const Orders = require("../models/Order");
const OrderMessage = require("../models/OrderMessage");

// Utils
const { calculateDistance, fromKMtoM, createAutomaticCheckout } = require("../utils/utils");
const { errorGenerator } = require("../utils/curries");
const cloudinary = require("../utils/cloudinary");
const { uploadEstablishment } = require("../utils/multer");
const Order = require("../models/Order");

// Helpers
Date.prototype.addHours= function(h){
  this.setHours(this.getHours()+h);
  return this;
};



/**
 * @route   GET /orders/get-by-establishment
 * @desc    Get a order by establishment Id
 * @param   {String} id_establishment
 * @private
 */
router.get("/get-by-establishment", passport.authenticate(["jwt", "google", "facebook"], { session: false }), async (req, res) => {
    
    const { e400, presetE400, presetE500 } = errorGenerator(res);

    const { id_establishment } = req.query || req.params;

    let { _id, type } = await req.user;
    if(!_id || !type) return presetE400();
    if(/user/ig.test(type)) return res.status(401).send("Unauthorized");
  
    Orders
      .find({ id_establishment })
      .sort({ orderTime: -1 })
      .exec((err, orders) => {
        if(err) return e400(err)();
  
        let allOrders = Promise.all(orders.map(async order => {

          let _order = {};

          let orderMessages = await OrderMessage.find({ id_order: order._id } , (err) => err ? e400(err)() : "");

          _order._id = order._id;
          _order.user_name = order.user_name || null;
          _order.address = order.address;
          _order.phone = order.phone;
          _order.orderTime = order.orderTime;
          _order.deliveredTime = order.deliveredTime;
          _order.status = order.status;
          _order.id_users = order.id_users;
          _order.created_at = order.created_at || null;
          _order.updated_at = order.updated_at || null;
          _order.orderMessages = orderMessages;

          _order.establishment = {};

          let establishment = await Establishment.findOne({ _id: order.id_establishment }, (err) => err ? e404(err)() : "");

          if (establishment) {

            if (orderMessages.length > 0) {
              _order.establishment_name = establishment.name || null;
            }

            let opening_hours = await Opening_hours.findById(establishment.id_opening_hours, (err) => err ? e400(err)() : "");
            let category = await Category.findById(establishment.id_category, (err) => err ? e400(err)() : "");

            let _establishment = {};

            _establishment._id = establishment._id;
            _establishment.name = establishment.name;
            _establishment.phone = establishment.phone;
            _establishment.description = establishment.description;
            _establishment.category = category ? category.name : "";
            _establishment.isActive = establishment.isActive;
            _establishment.current_affluences = establishment.current_affluences;
            _establishment.max_affluences_allowed = establishment.max_affluences_allowed;
            _establishment.shift_attention_mins = establishment.shift_attention_mins || 10;
            _establishment.shift_schedule_max_hours = establishment.shift_schedule_max_hours;
            _establishment.checkin_max_min = establishment.checkin_max_min;
            _establishment.max_shifts = establishment.max_shifts;
            _establishment.max_persons_per_slot = establishment.max_persons_per_slot;
            _establishment.slot_size = establishment.slot_size;
            _establishment.enableShifting = establishment.enableShifting;
            _establishment.enable_ask_document = establishment.enable_ask_document;
            _establishment.enableShopping = establishment.enableShopping;
            _establishment.opening_hours = opening_hours;
            _establishment.location = establishment.location;
            _establishment.establishment_pics_url = establishment.establishment_pics_url || [];
            _establishment.num_per_shift = establishment.num_per_shift || null;
            _establishment.enable_num_people = establishment.enable_num_people || false;
            _establishment.shifts_checked_at = establishment.shifts_checked_at || null;
            _establishment.orders_checked_at = establishment.orders_checked_at || null;

            _order.establishment = _establishment;

          }

          return _order;
        }));
  
        allOrders
          .then(orders => {
  
            let _orders = orders.filter(order => order);

            // This is for show the user the last time he/she visited the service
            // After he/she ask for the service
            // This code updates the last time the user saw the ORDERS
            const timeForUpdateLatestView = 1;

            console.log("TASK Orders: [⏰] Update last view for Store: " + id_establishment + " will start in: " + timeForUpdateLatestView + " minutes.");
            let lastViewOrder = cron.schedule(`*/${timeForUpdateLatestView} * * * *`, () => {
              console.log("TASK Orders: [⏰⏰] Update last view for Store: " + id_establishment + " has started.");

              Establishment.findByIdAndUpdate(id_establishment, { orders_checked_at: new Date() }, (err, _) => {
                if (err) return e400(err)();
                console.log("TASK Orders: [✅] Last Order view for Store: " + id_establishment + " has been updated.");
                lastViewOrder.destroy();
              });
            });

            return res.json({
              success: true,
              total: _orders.length,
              values: _orders
            });
          })
          .catch(presetE500);
      });

});




/**
 * @route   GET /orders/get-by-user
 * @desc    Get a order by user Id
 * @private
 */
router.get("/get-by-user", passport.authenticate(["jwt", "google", "facebook"], { session: false }), async (req, res) => {

    const { e400, presetE400, presetE500 } = errorGenerator(res);
    let { _id, type, email } = await req.user;
    if(!_id || !type) return presetE400();
    if(/owner/ig.test(type)) return res.status(401).send("Unauthorized");
  
    Orders
      .find({ id_users: _id })
      .sort({ orderTime: -1 })
      .exec((err, orders) => {
        if(err) return e400(err)();
  
        let allOrders = Promise.all(orders.map(async order => {
          let _order = {};

          let orderMessages = await OrderMessage.find({ id_order: order._id } , (err) => err ? e400(err)() : "");
          
          _order._id = order._id;
          _order.user_name = order.user_name || null;
          _order.address = order.address;
          _order.phone = order.phone;
          _order.orderTime = order.orderTime;
          _order.deliveredTime = order.deliveredTime;
          _order.status = order.status;
          _order.id_users = order.id_users;
          _order.orderMessages = orderMessages;

          _order.establishment = {};

          let establishment = await Establishment.findOne({ _id: order.id_establishment }, (err) => err ? e404(err)() : "");

          if (establishment) {

            if (orderMessages.length > 0) {
              _order.establishment_name = establishment.name || null;
            }

            let opening_hours = await Opening_hours.findById(establishment.id_opening_hours, (err) => err ? e400(err)() : "");
            let category = await Category.findById(establishment.id_category, (err) => err ? e400(err)() : "");

            let _establishment = {};

            _establishment._id = establishment._id;
            _establishment.name = establishment.name;
            _establishment.phone = establishment.phone;
            _establishment.description = establishment.description;
            if(category) {
              _establishment.category = category.name;
            }
            _establishment.isActive = establishment.isActive;
            _establishment.current_affluences = establishment.current_affluences;
            _establishment.max_affluences_allowed = establishment.max_affluences_allowed;
            _establishment.shift_attention_mins = establishment.shift_attention_mins || 10;
            _establishment.shift_schedule_max_hours = establishment.shift_schedule_max_hours;
            _establishment.checkin_max_min = establishment.checkin_max_min;
            _establishment.max_shifts = establishment.max_shifts;
            _establishment.max_persons_per_slot = establishment.max_persons_per_slot;
            _establishment.slot_size = establishment.slot_size;
            _establishment.enableShifting = establishment.enableShifting;
            _establishment.enable_ask_document = establishment.enable_ask_document;
            _establishment.enableShopping = establishment.enableShopping;
            _establishment.opening_hours = opening_hours;
            _establishment.location = establishment.location;
            _establishment.establishment_pics_url = establishment.establishment_pics_url || [];
            _establishment.num_per_shift = establishment.num_per_shift || null;
            _establishment.enable_num_people = establishment.enable_num_people || false;

            _order.establishment = _establishment

          }

          return _order;
        }));
  
        allOrders
          .then(orders => {
  
            let _orders = orders.filter(order => order);
  
            res.json({
              success: true,
              total: _orders.length,
              values: _orders
            });
          })
          .catch(presetE500);
      });
});




/**
 * @route   POST /routes/new
 * @desc    Create a new order.
 * @body    {String} address
 * @body    {String} phone
 * @body    {Date} orderTime
 * @body    {Date} deliveredTime
 * @body    {String} status
 * @body    {String} id_establishment
 * @body    {String} message
 * @body    {String} userName
 * @private
 */
router.post("/new", passport.authenticate(["jwt", "google", "facebook"], { session: false }), async (req,res) => {

    const { e400, presetE400 } = errorGenerator(res);
    let { _id, type } = await req.user;
    if(!_id) return presetE400();

    let {
        address,
        phone,
        orderTime,
        deliveredTime,
        status,
        id_establishment,
        message,
        userName
      } = req.body;

    if (!message) return presetE400("This order does not have a message.");
    if (!address) return presetE400("This order does not have an address.");
    if (!phone)   return presetE400("This order does not have a phone number.");
    if (!id_establishment) return presetE400("This order does not have an establishment");
    
    // Receiving and building the Establishment model
    let newOrder = new Orders({
        user_name : userName,
        address,
        phone,
        orderTime,
        deliveredTime,
        status,
        id_establishment,
        id_users: _id
    });

    // Saving Order
    newOrder.save((err, order) => {
        if (err) return e400(err)();

        let newOrderMessage =  new OrderMessage({
          id_establishment,
          id_users: _id,
          id_order: order._id,
          conversation: [
            {
              sender: _id,
              senderType: type,
              text: message
            }
          ]
        });

        newOrderMessage.save( (err, orderMessage) => {
          if (err) return e400(err)();

          Users.findByIdAndUpdate(_id, { name: userName }, (err) => err ? e400(err)() : "");

          res.json({
            success: true,
            order,
            orderMessage
          });

        });
    });
});



/**
 * @route   PUT /routes/update/
 * @desc    Create a new order.
 * @param   {String} id Order'id
 * @body    {String} address (optional)
 * @body    {String} phone (optional)
 * @body    {Date} orderTime (optional)
 * @body    {Date} deliveredTime (optional)
 * @body    {String} status (optional)
 * @body    {String} id_establishment (optional)
 * @private
 */
router.put("/update",  passport.authenticate(["jwt", "google", "facebook"], { session: false }), (req,res) => {

    let { id } = req.query;
    const { e400, presetE400, presetE404, e404 } = errorGenerator(res);
  
    if(!id || id === "undefined") return presetE400();
  
    Orders
      .findByIdAndUpdate(id, req.body, async (err, order) => {
        if (err) return e400(err)();

        if (req.body.userName) {
          // Because on model is user_name but the request is sent as userName
          Orders.findByIdAndUpdate(id, { user_name: req.body.userName }, (err) => err ? e400(err)() : "");
          Users.findByIdAndUpdate(order.id_users, { name: req.body.userName }, (err) => err ? e400(err)() : "");
        }
  
        if(order){
          return res.json({
            success: true,
            message: "Order successfully updated",
            updated: req.body
          });
  
        }else{
          return e404("NOT_FOUND")("Order not found");
        }
      });

});




/**
 * @route   GET /orders/get-by-id
 * @desc    Get a order by id
 * @param   {String} id Order id
 * @public
 */
router.get("/get-by-id", (req,res) => {

    let { id } = req.query || req.params;
    const { e400, e404 } = errorGenerator(res);
  
    Orders.findOne({ _id: id }, async (err, order) => {
      if(err) return e400(err)();
  
      if(order){
            
          let _order = {};

          let orderMessages = await OrderMessage.find({ id_order: order._id } , (err) => err ? e400(err)() : "");
          
          _order._id = order._id;
          _order.user_name = order.user_name || null;
          _order.address = order.address;
          _order.phone = order.phone;
          _order.orderTime = order.orderTime;
          _order.deliveredTime = order.deliveredTime;
          _order.status = order.status;
          _order.id_users = order.id_users;
          _order.orderMessages = orderMessages;
          _order.establishment = {};

          let establishment = await Establishment.findOne({ _id: order.id_establishment }, (err) => err ? e404(err)() : "");
          
          if (establishment) {

            if (orderMessages.length > 0) {
              _order.establishment_name = establishment.name || null;
            }

            let opening_hours = await Opening_hours.findById(establishment.id_opening_hours, (err) => err ? e400(err)() : "");
            let category = await Category.findById(establishment.id_category, (err) => err ? e400(err)() : "");

            let _establishment = {};

            _establishment._id = establishment._id;
            _establishment.name = establishment.name;
            _establishment.phone = establishment.phone;
            _establishment.description = establishment.description;
            if(category) {
              _establishment.category = category.name;
            }
            _establishment.isActive = establishment.isActive;
            _establishment.current_affluences = establishment.current_affluences;
            _establishment.max_affluences_allowed = establishment.max_affluences_allowed;
            _establishment.shift_attention_mins = establishment.shift_attention_mins || 10;
            _establishment.shift_schedule_max_hours = establishment.shift_schedule_max_hours;
            _establishment.checkin_max_min = establishment.checkin_max_min;
            _establishment.max_shifts = establishment.max_shifts;
            _establishment.max_persons_per_slot = establishment.max_persons_per_slot;
            _establishment.slot_size = establishment.slot_size;
            _establishment.enableShifting = establishment.enableShifting;
            _establishment.enable_ask_document = establishment.enable_ask_document;
            _establishment.enableShopping = establishment.enableShopping;
            _establishment.opening_hours = opening_hours;
            _establishment.location = establishment.location;
            _establishment.establishment_pics_url = establishment.establishment_pics_url || [];
            _establishment.num_per_shift = establishment.num_per_shift || null;
            _establishment.enable_num_people = establishment.enable_num_people || false;

            _order.establishment = _establishment
          }


          return res.json({
            success: true,
            order: _order
          });

      }else{
        return e404("NOT_FOUND")("Order not found");
      }
    });
});




/**
 * @route   POST /orders/chat-owner
 * @desc    Post a new message from the Owner to the User
 * @param   {String} id Order id
 * @body    {String} message
 * @private
 */
router.post("/chat-owner",  passport.authenticate(["jwt", "google", "facebook"], { session: false }), async (req,res) => {

  const { e400, presetE400, presetE404, e404 } = errorGenerator(res);
  let { id_order } = req.query;
  let { message } = req.body;
  
  let { _id, type } = await req.user;
  if(!_id || !type || !message || !id_order ) return presetE400();

  if(/user/ig.test(type)) return res.status(401).send("Unauthorized");

  OrderMessage
    .findOne({ id_order: id_order },(err, orderMessage) => {
      if (err) return e400(err)();

      if(orderMessage){

        let newMessage = {
          sender: _id,
          senderType: type,
          text: message
        };

        let newConversation = [];

        orderMessage.conversation.map(_message => {
          newConversation.push(_message);
        });

        newConversation.push(newMessage);

        OrderMessage
          .findByIdAndUpdate( orderMessage._id, { conversation : newConversation }, (err, orderMessage) => {
            if(err) return e400(err)();

            res.json({
              success: true,
              orderMessage
            });

          });
      }else{
        return presetE404("OrderMessage not found");
      }

    });
});



/**
 * @route   POST /orders/chat-user
 * @desc    Post a new message from the User to the Owner
 * @param   {String} id Order id
 * @body    {String} message
 * @private
 */
router.post("/chat-user",  passport.authenticate(["jwt", "google", "facebook"], { session: false }), async (req,res) => {

  const { e400, presetE400, presetE404, e404 } = errorGenerator(res);
  let { id_order } = req.query;
  let { message } = req.body;
  
  let { _id, type } = await req.user;
  if(!_id || !type || !message || !id_order ) return presetE400();

  if(/owner/ig.test(type)) return res.status(401).send("Unauthorized");

  OrderMessage
    .findOne({ id_order: id_order },(err, orderMessage) => {
      if (err) return e400(err)();

      if(orderMessage){

        let newMessage = {
          sender: _id,
          senderType: type,
          text: message
        };

        let newConversation = [];

        orderMessage.conversation.map(_message => {
          newConversation.push(_message);
        });

        newConversation.push(newMessage);

        OrderMessage
          .findByIdAndUpdate( orderMessage._id, { conversation : newConversation }, (err, orderMessage) => {
            if(err) return e400(err)();

            res.json({
              success: true,
              orderMessage
            });

          });
      }else{
        return presetE404("OrderMessage not found");
      }

    });
});



/**
 * @route   DELETE /routes/remove
 * @desc    Get a order by id
 * @param   {String} id Order id
 * @private
 */
router.delete("/remove", passport.authenticate(["jwt", "google", "facebook"], { session: false }), (req, res) => {

    let { id } = req.query;
    const { e400, presetE400, presetE404 } = errorGenerator(res);
    if(!id || id === "undefined") return presetE400();
  
    Orders.findOne({ _id: id }, (err, order) => {
      if(err) return e400(err)();
  
      if(order){
  
        // Delete first item found with commentId
        Orders.deleteOne({ _id: id }, (err, result) => {
        if (err) return e400(err)();

        res.json({
            success: true,
            result
        });
        });
        
      }else{
        return presetE404("Order is undefined");
      }
    });

});


module.exports = router;
