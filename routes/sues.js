const express = require('express');
const router = express.Router();
const request = require('request');

const Sue = require("../models/Sue");
const User = require("../models/Users");

router.get("/params", (req,res,_) => {
    res.json({
        name: "sues_params",
        params: [
            {
                name: "Categories",
                value: [
                    "Influx",
                    "Not-vital establishment opened",
                    "Grocery level price",
                    "Sport activity in hours not allowed",
                    "Other"
                ]
            },
            {
                name: "AfluencesQuantity",
                value: [
                    "+5",
                    "+10",
                    "+20"
                ]
            },
            {
                name: "MenuCategory",
                value: [
                    "Active",
                    "Solved",
                    "By Date"
                ]
            },
            {
                name: "Distances",
                value: [
                  "m",
                  "km"
                ]
            },
            {
                name: "StatusAffluences",
                value: [
                  "Empty",
                  "Half",
                  "Full"
                ]
            }
        ]
    });
});

router.get("/methods", (req,res) => {
    res.json({
        methods: [
            {
              value: "/sues/",
              name: "Get all the sues",
              type: "GET",
              access: "Public"
            },
            {
              value: "/sues/new",
              name: "Creat new Sue",
              type: "POST",
              access: "Private"
            },
            {
              value: "/sues/remove/:id",
              name: "Delete a sue by id",
              type: "DELETE",
              access: "Private"
            }
          ]
    })
});

router.get("/docs",(req,res) => {
    res.render('sues_docs')
});



// 
router.get("/", (req,res) => {
    Sue.find((err, sues) => {
        if(err) return res.status(400).json(err);

        // The goal is to rebuild the values for each sue
        // An empty array was created to customize the response
        let values_sues = [];

        sues.map((sue,index) => {
                // New object for each iteration
                let newSue = {};

                // Construct the object
                newSue._id = sue._id;
                newSue.id_person = sue.id_person;
                newSue.sue_category = sue.sue_category;
                newSue.title = sue.title;
                newSue.description = sue.description;
                newSue.date = sue.date;
                newSue.location = {
                    longitude: sue.location.longitude,
                    latitude: sue.location.latitude,
                    city: sue.location.city,
                    stateCode: sue.location.stateCode,
                    postalCode: sue.location.postalCode,
                    countryCode: sue.location.countryCode,
                    street: sue.location.street,
                    type: sue.location.type,
                    display_name: sue.location.display_name
                };

                // Add the object to the whole array of sues
                values_sues.push(newSue);

                // Only send the response to the client one time before the end of the iteration
                if(sues.length - 1 == index){
                    res.json({
                        total: sues.length,
                        values: values_sues
                    });
                }
            
            });
    });
});


/**
 * @route   POST /sues/new
 * @desc    Create a new sue
 * @param   {String} sue_category Sue's category i.e. Influx
 * @param   {Object} location i.e { longitude : //.. , latitude: //.. } 
 * @param   {String} title
 * @param   {String} description
 * @public
 */
router.post("/new", (req,res,_) => {

    let {
        sue_category,
        location,
        title,
        description
    } = req.body;

    const newSue = new Sue({
        location,
        sue_category,
        title,
        description
    });

    newSue.save((err, sue) => {
        if(err) return res.status(400).json(err);
        res.json({
            success: true,
            sue
        });
    });
   
});

router.delete("/remove", (req,res,_) => {
    Sue.findOne({ _id: req.body.id_sue }, (err, result) => {
        if (err) return res.status(400).json(err);
        res.json({
            success: true,
            result
        });
    });
});

module.exports = router;
