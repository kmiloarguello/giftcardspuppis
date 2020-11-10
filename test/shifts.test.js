const chai = require('chai');
let server = require ('../app');

const expect = chai.expect;
const assert = chai.assert;
const request = require('supertest');

// let date_may_8_00_am = 1589005800000; // GMT +2
// let id_shift = "5eb6f69a97f1f41c8cfb2654";

const createANewShift = (new_shift, token) => {
    return request(server)
            .post("/shifts/new/")
            .set("Authorization", token)
            .send({ 
                shift_date: new_shift.shift_date, 
                comments: new_shift.comments,
                id_establishment: new_shift.id_establishment,
                id_users: new_shift.id_users
            })
            .expect(200)
            .expect('Content-Type', /json/)
            .expect(res => {
                expect(res.body).not.to.be.empty;
                expect(res.body).to.be.an('object');
                res.body.success.should.be.true;
                assert.isString(res.body.shift.comments);
                assert.isAtLeast(res.body.remaining,0);
            });
}

const filledSlotShifts = (new_shift, token) => {
    return request(server)
            .post("/shifts/new/")
            .set("Authorization", token)
            .send({ 
                shift_date: new_shift.shift_date, 
                comments: new_shift.comments,
                id_establishment: new_shift.id_establishment,
                id_users: new_shift.id_users
            })
            .expect(400)
            .expect('Content-Type', /json/)
            .expect(res => {
                expect(res.body).not.to.be.empty;
                expect(res.body).to.be.an('object');
                res.body.success.should.be.false;
                assert.isAtLeast(res.body.remaining,0);
                assert.isAtMost(res.body.other_shifts.total,res.body.maximum_shifts)
            });
}


const createShiftinTwoMonths = (new_shift, token) => {
    return request(server)
            .post("/shifts/new/")
            .set("Authorization", token)
            .send({ 
                shift_date: new_shift.shift_date, 
                comments: new_shift.comments,
                id_establishment: new_shift.id_establishment,
                id_users: new_shift.id_users
            })
            .expect(400)
            .expect('Content-Type', /json/)
            .expect(res => {
                expect(res.body).not.to.be.empty;
                expect(res.body).to.be.an('object');
                res.body.success.should.be.false;
            });
}

const shiftsByEstablishment = (id) => {
    return request(server)
                .get('/shifts/?id_establishment='+ id)
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => {
                    expect(res.body).not.to.be.empty;
                    expect(res.body).to.be.an('object');
                    res.body.success.should.be.true;
                    expect(res.body.shifts).not.to.be.empty;
                    res.body.shifts.map(shift => {
                        expect(shift._id).not.to.be.undefined;
                        expect(shift.shift_date).not.to.be.undefined;
                        expect(shift.shift_date).not.to.be.null;
                        assert.isString(shift.comments);
                    });
                });
}

const shiftsByDate = (id,date) => {
    return request(server)
                .get("/shifts/get-by-date/?id_establishment=" + id + "&date=" + date)
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => {
                    expect(res.body).not.to.be.empty;
                    expect(res.body).to.be.an('object');
                    res.body.success.should.be.true;
                    expect(res.body.slots).not.to.be.null;
                    res.body.slots.map(slot => {
                        expect(slot.hours).not.to.be.null;
                        assert.isAtMost(slot.taken_shifts,slot.total_shifts);
                        expect(slot.total_shifts - slot.taken_shifts).to.equal(slot.remaining_shifts);
                        assert.isAtLeast(slot.remaining_shifts,0);
                    });
                });
}

const shiftById = (id,token) => {
    return request(server)
                .get("/shifts/get-by-id/?id=" + id)
                .set('Authorization', token)
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => {
                    expect(res.body).not.to.be.empty;
                    expect(res.body).to.be.an('object');
                    res.body.success.should.be.true;
                    expect(res.body.shift).not.to.be.undefined;
                    expect(res.body.shift).not.to.be.empty;
                });
}

const updateShift = (id, valueToUpdate, token) => {
    
    return request(server)
                .put("/shifts/update/?id=" + id)
                .set("Authorization", token)
                .send(valueToUpdate)
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => {
                    expect(res.body).not.to.be.empty;
                    expect(res.body).to.be.an('object');
                    res.body.success.should.be.true;
                    // assert.isString(res.body.shift.comments);
                })
}

const updateWrongShift = (id, valueToUpdate, token) => {
    return request(server)
                .put("/shifts/update/?id=" + id)
                .set("Authorization", token)
                .send(valueToUpdate)
                .expect(400)
                .expect('Content-Type', /json/)
                .expect(res => {
                    expect(res.body).not.to.be.empty;
                    expect(res.body).to.be.an('object');
                    res.body.success.should.be.false;
                })
}


const deleteShiftById = (id, token) => {
    return request(server)
                .delete("/shifts/remove/?id=" + id)
                .set('Accept', 'application/json')
                .set('Content-Type', 'application/json')
                .set("Authorization", token)
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => {
                    expect(res.body).not.to.be.empty;
                    expect(res.body).to.be.an('object');
                    res.body.success.should.be.true;
                });
}


module.exports = {
    createANewShift,
    shiftsByEstablishment,
    shiftsByDate,
    shiftById,
    updateShift,
    updateWrongShift,
    filledSlotShifts,
    deleteShiftById,
    createShiftinTwoMonths
};