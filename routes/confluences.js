const express = require('express');
const router = express.Router();
const request = require('request');
const Category = require('../models/Category');

const { errorGenerator } = require("../utils/curries");


/**
 * @route   GET /confluences/params
 * @desc    Gives the params available to the client
 * @todo    Store the values in a correct DB
 * @public
 */
router.get("/params", async (_, res) => {
    const { presetE500 } = errorGenerator(res);
    let all_categories = await Category.find((err) => err ? res.status(400).json(err) : "");
    
    let _categories = Promise.all(all_categories.map(category => {
        if(category){
            let myCategory = {};

            myCategory.en = category.name;
            myCategory.es = category.name_es;
            myCategory.fr = category.name_fr;
            myCategory.position = category.position;

            return myCategory;
        }
    }));

    _categories
        .then(categories => {

            res.json({
                name: "confluences_params",
                params: [
                    {
                        name: "Categories",
                        value: categories
                    },
                    {
                        name: "Timetable",
                        value: [
                            "Now",
                            "Two hours ago",
                            "One day ago",
                            "One week ago"
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
                        name: "DistanceEstablishment",
                        value: [
                            "500m",
                            "1km",
                            "2km",
                            "4km",
                            "8km",
                            "50km"
                        ],
                        units: "km"
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
            })

        })
        .catch(presetE500)

    
});

/**
 * @route   POST /confluecnes/search-by-id
 * @desc    Search establishment by establishment's id
 * @param   {String} id
 * @private 
 */
router.get("/", (req, res, next) => {

    // https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=-48.8670522,2.1957362&radius=1500&type=farmacy&keyword=cruise&key=OWN_KEY
    // https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=-48.8670522,2.1957362&radius=1500&type=farmacy&keyword=cruise&fields=formatted_address,name,rating,opening_hours,geometry&key=OWN_KEY

    res.json({
        dest_category: "pharmacie",
        location: {
            latitude: 48.123,
            longitude: 5.123
        },
        status: "full"
    });

});

// @route   Post api/comments/new
// @desc    Add a new comment to the DB, update the users ID
// @access  Private

router.get("/countries", (req, res) => {

    let URL_request = `https://restcountries.eu/rest/v2/all`;

    request(URL_request, (error, response, body) => {
        if (error) console.log("error: ", error);
        body = JSON.parse(body);

        let myCountries = [];

        body.map(country => {
            myCountries.push({
                name: country.name,
                code: country.alpha2Code
            });
        });

        res.json({
            success: true,
            name: "Countries",
            total : myCountries.length,
            countries: myCountries
        });
    });

});


router.post("/get-city", (req,res) => {
    let {
        country_code
    } = req.body;

    let URL_request = `https://restcountries.eu/rest/v2/alpha/` + country_code;

    request(URL_request, (error, response, body) => {
        if (error) console.log("error: ", error);
        body = JSON.parse(body);

        res.json({
            success: true,
            name: "Cities",
            country: body.name,
            total: 1,
            city: [body.capital]
        });
    });

});


module.exports = router;
