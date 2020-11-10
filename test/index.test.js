const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;

const {
    createANewOwner,
    createANewSession,
    getEstablishmentsByOwner,
    deleteAnOwner,
    updateOwnerPassword
} = require("./owner.test");

const {
    createANewEstablishment,
    findEstablishments,
    deleteEstablishmentById,
    createANewCategory,
    checkCategoryType,
    deleteACategory,
    searchEstablishmentsByName,
    updateEstablishment,
    updateWrongEstablishment
} = require("./establishment.test");

const {
    createANewShift,
    shiftsByEstablishment,
    shiftsByDate,
    shiftById,
    updateShift,
    updateWrongShift,
    filledSlotShifts,
    deleteShiftById,
    createShiftinTwoMonths
} = require("./shifts.test");

const { getRandomInt } = require("../utils/utils");

let data_owner = {};
let data_user = {};
let data_est = "";
let data_find_est = "";
let data_category = "";
let data_shift = "";
let data_shifts_multiple = "";

before(async () => {
    let newOwner = await createANewOwner();
    data_owner.id = newOwner.body.owner._id;
    data_owner.email = newOwner.body.owner.email;
    data_owner.password = "ca123";
});

before(async () => {
    let ownerLogin = await createANewSession(data_owner.email, data_owner.password);
    data_owner.token = ownerLogin.body.token;
    data_owner.id = ownerLogin.body.id_owner;
    data_est = require("./data").data_new_establishment;
    data_est.id_owner = ownerLogin.body.id_owner;
    data_find_est = require("./data").data_find_establishment;
    data_category = require("./data").data_new_category;
});

describe("CONFLUX Backend Tests", () => {
    describe("Owners", () => {
        describe("POST /", () => {
            it("should generate a valid JWT token.", async () => {
                await createANewSession(data_owner.email, data_owner.password);
            });
        });
        describe("GET /", () => {
            it("should get an establishment by owner.", async () => {
                await getEstablishmentsByOwner(data_owner.token);
            });
        });
        describe("PUT /", () => {
            data_owner.password = "ca1234"
            it("should update the owner's password.", () => updateOwnerPassword(data_owner.password, data_owner.token));
        });
    });

    describe("Establishment", () => {
        describe("POST /", () => {
            it("should create a new category.", async () => {
                let newCategory = await createANewCategory(data_category, data_owner.token);
                data_category.id = newCategory.body.category._id;
            });
            it("should create a new establishment.", async () => {
                let newEstablishment = await createANewEstablishment(data_est, data_owner.token);
                data_est.id = newEstablishment.body.establishment._id;
            });
        });
        describe("GET /", () => {
            it("should get some establishments based on the name.", async () => {
                let { name1, name2, name3, name4 } = require("./data").data_search_establishment_name;
                await searchEstablishmentsByName(name1);
                await searchEstablishmentsByName(name2);
                await searchEstablishmentsByName(name3);
                await searchEstablishmentsByName(name4);
            });
            it("should get some establishments based on input values.", () => findEstablishments(data_find_est));
            it("should verify whether all the establishments have latitude and longitude.", async () => {
                let res = await findEstablishments(data_find_est);
                res.body.values.map(establishment => {
                    expect(establishment.location.longitude).not.to.be.undefined;
                    expect(establishment.location.latitude).not.to.be.undefined;
                    expect(establishment.location.longitude).not.to.be.null;
                    expect(establishment.location.latitude).not.to.be.null;
                });
            });
            it("should verify whether all the establishments have category.", async () => {
                let res = await findEstablishments(data_find_est);
                res.body.values.map(establishment => {
                    expect(establishment.category).not.to.be.undefined;
                });
            });
            it("should prevent two categories with the same name.", () => checkCategoryType());
            it("should have the `max_shifts` attribute in range 0..1.", async () => {
                let res = await findEstablishments(data_find_est);
                res.body.values.map(establishment => {
                    expect(establishment.max_shifts).not.to.be.undefined;
                    assert.isAtLeast(establishment.max_shifts,0);
                    assert.isAtMost(establishment.max_shifts,1);
                });
            });
        });
        describe("PUT /", () => {
            it("should update the establishment name.", async () => {
                let newName = require("./data").data_new_establishment_name;
                await updateEstablishment(data_est.id,{ name: newName },data_owner.token);
            });
            it("should update the establishment close hour.", async () => {
                let new_timetable = require("./data").data_new_establishment_timetable;
                await updateEstablishment(data_est.id, { opening_hours: new_timetable } ,data_owner.token);
            });
            it("should update the establishment category.", async () => {
                let new_category = require("./data").data_new_establishment_category;
                await updateEstablishment(data_est.id, { categoryName: new_category } ,data_owner.token);
            });
            it("should not allow to update the establishment with a wrong category.", async () => {
                let new_category = require("./data").data_new_establishment_wrong_category;
                await updateWrongEstablishment(data_est.id, { categoryName: new_category } ,data_owner.token);
            });
            it("should update the `current_affluences` value.", () => updateEstablishment(data_est.id, { current_affluence : getRandomInt(10) }, data_owner.token));
        });
    });

    describe("Shifts", () => {
        describe("POST /", () => {
            it("should create a new shift.", async () => {
                data_shift = require("./data").data_new_shift;
                data_shift.id_establishment = data_est.id;
                data_shift.id_users = data_owner.id;
                let newShift = await createANewShift(data_shift,data_owner.token);
                data_shift.id = newShift.body.shift.id;
            });
            it("should not allow to create a shift in a filled slot.", async () => {
                data_shifts_multiple = require("./data").data_shifts_multiple_same_slot;
                
                data_shifts_multiple.map(shift => {
                    shift.id_establishment = data_est.id;
                    shift.id_users = data_owner.id;
                });

                let shift0 = await createANewShift(data_shifts_multiple[0],data_owner.token);
                let shift1 = await createANewShift(data_shifts_multiple[1],data_owner.token);
                let shift2 = await createANewShift(data_shifts_multiple[2],data_owner.token);
                let shift3 = await createANewShift(data_shifts_multiple[3],data_owner.token);
                let shift4 = await createANewShift(data_shifts_multiple[4],data_owner.token);
                // Maximum
                await filledSlotShifts(data_shifts_multiple[3],data_owner.token);
                await filledSlotShifts(data_shifts_multiple[4],data_owner.token);

                data_shifts_multiple[0].id = shift0.body.shift.id;
                data_shifts_multiple[1].id = shift1.body.shift.id;
                data_shifts_multiple[2].id = shift2.body.shift.id;
                data_shifts_multiple[3].id = shift3.body.shift.id;
                data_shifts_multiple[4].id = shift4.body.shift.id;

            });
            // ?  it("should allow create a shift by an owner.");
            it("should not allow create a shift in a time range larger than establishment shift_schedule_max_hours.", async () => {
                let data_shift1 = require("./data").data_shift_too_far_away;
                data_shift1.id_establishment = data_est.id;
                data_shift1.id_users = data_owner.id;
                
                await createShiftinTwoMonths(data_shift1,data_owner.token)
            });
            it("should create two or more shifts for the same user (one after another one)");
            // // it("should create a maximum nb_shift_max per day.");
        });
        describe("GET /", () => {
            it("should get shifts by establishment.", () => shiftsByEstablishment(data_est.id)); // INCLUDE THE ID_USER
            it("should get shifts by date and establishment.", () => shiftsByDate(data_est.id,data_shift.shift_date));
            it("should get shift by its id.", () => shiftById(data_shift.id,data_owner.token));
        });
        describe("PUT /", () => {
            it("should update the shift's date.", async () => {
                data_shift.shift_date = require("./data").data_update_shift.shift_date;
                await updateShift( data_shift.id, { shift_date: data_shift.shift_date } , data_owner.token);
            });
            it("should not allow a date in other format than timestamp", () => {
                data_shift.shift_date = require("./data").data_update_wrong_shift.shift_date;
                updateShift( data_shift.id,
                            { shift_date: data_shift.shift_date },
                            data_owner.token);
            });
            it("should not allow a comments in other format than string", () => {
                data_shift.shift_date = require("./data").data_update_wrong_shift.shift_date;
                updateShift( data_shift.id,
                            { shift_date: data_shift.shift_date },
                            data_owner.token);
            });
            it("should update the shift's comments.", () => {
                data_shift.comments = require("./data").data_update_shift.comments;
                updateShift( data_shift.id,
                            { comments: data_shift.comments },
                            data_owner.token);
            });
        });
    });

    describe("Visits", () => {
        describe("POST /", () => {
            it("should allow to make checkin in the time interval not greater than `checkin_max_min`."); // Check the location in the class diagram
            it("should allow to make checkin with a booked shift.");
            it("should allow to make checkin without a booked shift and with a non filled slot-time.");
            it("should not allow to create a new checkin when Affluences `current_affluence` and Establishment `max_affluence_allowed` are equals.");
            it("should prevent two or more checkins at the same time for the same user.");
        });
        describe("GET /", () => {
            it("should get the checkin's quantity at this slot");
            // ? it("should get the visits by radius area.");
            it("should get a visit by its id.");
            it("should get a visit by an specific date and establishment.");
        });
        describe("PUT /", () => {
            it("should allow make checkout with a date later than checkin's date."); // Check the location in the class diagram
            it("should make a checkout automatically after `shift_attention_mins` time."); // Maybe with a server job or using a hook
            it("should update the visit's checkin.");
        });
        describe("DELETE /", () => {
            it("should delete a visit.");
        });

    });

    describe("Final - Deletes", () => {
        describe("DELETE /", () => {
            it("should delete a shift.", async () => {
                await deleteShiftById(data_shift.id, data_owner.token);
                await deleteShiftById(data_shifts_multiple[0].id, data_owner.token);
                await deleteShiftById(data_shifts_multiple[1].id, data_owner.token);
                await deleteShiftById(data_shifts_multiple[2].id, data_owner.token);
                await deleteShiftById(data_shifts_multiple[3].id, data_owner.token);
                await deleteShiftById(data_shifts_multiple[4].id, data_owner.token);
            });
            it("should delete a category based on its id.", () => deleteACategory(data_category.id, data_owner.token));
            it("should delete an establishment based on its id.", () => deleteEstablishmentById(data_est.id, data_owner.token));
            it("should delete one owner.", () => deleteAnOwner(data_owner.id, data_owner.token));
        });
    });
});
