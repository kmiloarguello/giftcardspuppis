const { toTimestamp, getRandomInt } = require("../utils/utils");

Date.prototype.addHours = function(hours){
    this.setHours(this.getHours() + hours);
    return this;
};

let new_category = {
    name: "Supermarket" + getRandomInt(30)
}

let new_establishment = {
    name: "Store the new Juli 18",
    phone: 712345678,
    description: "Establishment to test",
    isActive: true,
    current_affluences: 1,
    max_affluences_allowed: 20,
    shift_attention_mins: 10,
    shift_schedule_max_hours: 48,
    checkin_max_min: 30,
    max_shifts: 1,
    max_persons_per_slot: 5,
    location: {
        latitude: "48.8566969",
        longitude: "2.3514616",
        address: "01 rue Paris",
        city: "Paris",
        stateCode: "75",
        postalCode: "75003",
        countryCode: "FR",
        country: "France"
    },
    categoryName: "Grocery",
    opening_hours: {
        day: [0,1,2,3],
        open_hour: toTimestamp(new Date()),
        close_hour: toTimestamp(new Date().addHours(5))
    }
};

let data_new_establishment_name = "Store the New Juli 18-19";
let data_new_establishment_category = "Supermarket";
let data_new_establishment_wrong_category = "Supermarket" + getRandomInt(10);
let data_new_establishment_timetable = {
    day: [0,1,2,3,4,5,6],
    open_hour: 1589205600000,
    close_hour: 1589248800000
}

let find_establishment_data = {
    latitude: "48.8566969",
    longitude: "2.3514616",
    radius: "8 Kms",
    category: "Pharmacy"
}

let search_establishment_by_name_data = {
    name1 : "store",
    name2 : "store the",
    name3 : "new Juli",
    name4 : "Store the new Juli 18"
}

let new_shift = {
    shift_date : toTimestamp(new Date().addHours(10)),
    comments: "This is a testing shift"
};

let update_shift = {
    shift_date: Date.now(),
    comments: "This is a new comment shift"
}
let update_wrong_shift = {
    shift_date: "Saturday, July 18, 2020 7:00:00 AM",
    comments: /$script$/
}

let data_shifts_multiple_same_slot = [
    {
        shift_date: 1589278500000,
        comments: "Shift1" 
    },
    {
        shift_date: 1589278500000,
        comments: "Shift2" 
    },
    {
        shift_date: 1589278500000,
        comments: "Shift3" 
    },
    {
        shift_date: 1589278500000,
        comments: "Shift4" 
    },
    {
        shift_date: 1589278500000,
        comments: "Shift5" 
    },
    {
        shift_date: 1589278500000,
        comments: "Shift6" 
    }
]

let data_shift_too_far_away = {
    shift_date: 1595055600000,
    comments: "Saturday, July 18, 2020 7:00:00 AM"
}

module.exports = {
    data_new_establishment: new_establishment,
    data_find_establishment: find_establishment_data,
    data_new_category: new_category,
    data_new_shift: new_shift,
    data_update_shift: update_shift,
    data_update_wrong_shift: update_wrong_shift,
    data_search_establishment_name: search_establishment_by_name_data,
    data_new_establishment_name,
    data_new_establishment_category,
    data_new_establishment_wrong_category,
    data_new_establishment_timetable,
    data_shifts_multiple_same_slot,
    data_shift_too_far_away
}
