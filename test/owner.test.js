const chai = require('chai');
const chaiHttp = require('chai-http');
let server = require('../app');
let should = chai.should();
chai.use(chaiHttp);
const expect = chai.expect;
const request = require('supertest');


const Onwers = require("../models/Owner");
const { getRandomInt } = require("../utils/utils")

let _randomValue = getRandomInt(20);

const createANewOwner = () => {
    return request(server)
                .post("/owners/signup")
                .set('Accept', 'application/json')
                .set('Content-Type', 'application/json')
                .send({ email: "ca" + _randomValue + "@conflux.fr", password: "ca123", userName: "CA" + _randomValue })
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(function (res) {
                    expect(res.body).not.to.be.empty;
                    expect(res.body).to.be.an('object');
                    expect(res.body.owner).to.be.an('object');
                });
}

const createANewSession = (email, password) => {
    return request(server)
        .post("/owners/signin")
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .send({ email, password })
        .expect(200)
        .expect('Content-Type', /json/)
        .expect(function (res) {
            expect(res.body).not.to.be.empty;
            expect(res.body).to.be.an('object');
            res.body.success.should.be.true;
            res.body.token.should.not.be.empty;
        });
}

const getEstablishmentsByOwner = (token) => {
    return request(server)
            .get("/owners/")
            .set('Accept', 'application/json')
            .set('Content-Type', 'application/json')
            .set("Authorization", token)
            .expect(200)
            .expect('Content-Type', /json/)
            .expect(res => {
                expect(res.body).not.to.be.empty;
                expect(res.body).to.be.an('object');
                res.body.success.should.be.true;
                expect(res.body.establishments).not.to.be.null;
            });
}

const updateOwnerPassword = (password,token) => {
    return request(server)
                .put("/owners/password")
                .set('Accept', 'application/json')
                .set('Content-Type', 'application/json')
                .set("Authorization", token)
                .send({ password })
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => {
                    expect(res.body).not.to.be.empty;
                    expect(res.body).to.be.an('object');
                    res.body.success.should.be.true;
                });
}

const deleteAnOwner = (id_owner, token) => {
    return request(server)
            .delete("/owners/remove")
            .set('Accept', 'application/json')
            .set('Content-Type', 'application/json')
            .set("Authorization", token)
            .send({ id: id_owner })
            .expect(200)
            .expect('Content-Type', /json/)
            .expect(function (response) {
                expect(response.body).not.to.be.empty;
                expect(response.body).to.be.an('object');
            });
}



module.exports = { 
    createANewOwner, 
    createANewSession, 
    deleteAnOwner, 
    getEstablishmentsByOwner,
    updateOwnerPassword
};