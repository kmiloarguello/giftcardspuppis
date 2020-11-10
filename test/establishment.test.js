const chai = require('chai');
const chaiHttp = require('chai-http');
let should = chai.should();
chai.use(chaiHttp);
const expect = chai.expect;
const assert = chai.assert;
const request = require('supertest');

let server = require ('../app');

const createANewEstablishment = (establishment,token) => {
    return request(server)
            .post("/establishment/new/")
            .set("Authorization", token)
            .send(establishment)
            .expect(200)
            .expect('Content-Type', /json/)
            .expect(res => {
                expect(res.body).not.to.be.empty;
                expect(res.body).to.be.an('object');
                res.body.success.should.be.true;
                assert.isNumber(res.body.establishment.current_affluences);
                assert.isNumber(res.body.establishment.max_affluences_allowed);
                assert.isNumber(res.body.establishment.shift_attention_mins);
                assert.isNumber(res.body.establishment.shift_schedule_max_hours);
                assert.isNumber(res.body.establishment.checkin_max_min);
                assert.isNumber(res.body.establishment.max_shifts);
                assert.isNumber(res.body.establishment.max_persons_per_slot);
                expect(res.body.establishment.location.longitude).not.to.be.undefined;
                expect(res.body.establishment.location.latitude).not.to.be.undefined;
                expect(res.body.establishment.location.longitude).not.to.be.null;
                expect(res.body.establishment.location.latitude).not.to.be.null;
            });
}

const updateEstablishment = (id,valuesToChange,token) => {
    return request(server)
            .put("/establishment/update/?id=" + id)
            .set("Authorization", token)
            .send(valuesToChange)
            .expect(200)
            .expect('Content-Type', /json/)
            .expect(res => {
                expect(res.body).not.to.be.empty;
                expect(res.body).to.be.an('object');
                res.body.success.should.be.true;
            });
}

const updateWrongEstablishment = (id,valuesToChange,token) => {
    return request(server)
            .put("/establishment/update/?id=" + id)
            .set("Authorization", token)
            .send(valuesToChange)
            .expect(404)
            .expect('Content-Type', /json/)
            .expect(res => {
                expect(res.body).not.to.be.empty;
                expect(res.body).to.be.an('object');
                res.body.success.should.be.false;
            });
}

const findEstablishments = (establishment) => {
    return request(server)
                .get("/establishment/?lat=" +  establishment.latitude + "&lng=" + establishment.longitude + "&radius=" + establishment.radius + "&category=" + establishment.category)
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => {
                    expect(res.body).not.to.be.empty;
                    expect(res.body).to.be.an('object');
                    res.body.success.should.be.true;
                    expect(res.body.values).not.to.be.null;
                    res.body.values.map(establishment => {
                        assert.isNumber(establishment.current_affluences);
                        assert.isNumber(establishment.max_affluences_allowed);
                        assert.isNumber(establishment.shift_attention_mins);
                        assert.isNumber(establishment.shift_schedule_max_hours);
                        assert.isNumber(establishment.checkin_max_min);
                        assert.isNumber(establishment.max_shifts);
                        assert.isNumber(establishment.max_persons_per_slot);
                        expect(establishment.location.longitude).not.to.be.undefined;
                        expect(establishment.location.latitude).not.to.be.undefined;
                        expect(establishment.location.longitude).not.to.be.null;
                        expect(establishment.location.latitude).not.to.be.null;
                    });
                    // expect(res.body.values).not.to.be.empty;
                });
}

const searchEstablishmentsByName = (name) => {
    return request(server)
                .get("/establishment/search/?query=" + name)
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => {
                    expect(res.body).not.to.be.empty;
                    expect(res.body).to.be.an('object');
                    res.body.success.should.be.true;
                    expect(res.body.establishments).not.to.be.undefined;
                    expect(res.body.establishments).not.to.be.null;

                    res.body.establishments.map(establishment => {
                        assert.isNumber(establishment.current_affluences);
                        assert.isNumber(establishment.max_affluences_allowed);
                        assert.isNumber(establishment.shift_attention_mins);
                        assert.isNumber(establishment.shift_schedule_max_hours);
                        assert.isNumber(establishment.checkin_max_min);
                        assert.isNumber(establishment.max_shifts);
                        assert.isNumber(establishment.max_persons_per_slot);
                        expect(establishment.location.longitude).not.to.be.undefined;
                        expect(establishment.location.latitude).not.to.be.undefined;
                        expect(establishment.location.longitude).not.to.be.null;
                        expect(establishment.location.latitude).not.to.be.null;
                    });

                });
}

const deleteEstablishmentById = (id, token) => {
    return request(server)
                .delete("/establishment/remove/?id=" + id)
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

const createANewCategory = (category,token) => {
    return request(server)
                .post("/establishment/category/new")
                .set('Accept', 'application/json')
                .set('Content-Type', 'application/json')
                .set("Authorization", token)
                .send(category)
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => {
                    expect(res.body).not.to.be.empty;
                    expect(res.body).to.be.an('object');
                    res.body.success.should.be.true;
                    expect(res.body.category.name).not.to.be.null;
                });
}

const deleteACategory = (id,token) => {
    return request(server)
                .delete("/establishment/category/remove/?id=" + id)
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

const checkCategoryType = () => {
    return request(server)
                .get("/establishment/category")
                .set('Accept', 'application/json')
                .set('Content-Type', 'application/json')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => {
                    expect(res.body).not.to.be.empty;
                    expect(res.body).to.be.an('object');
                    res.body.success.should.be.true;
                    expect(res.body.category).not.to.be.undefined;
                    expect(res.body.category).not.to.be.empty;
                    
                    res.body.category.map(cat => expect(cat.name).not.to.be.null );

                    // Check if there is more than 1 categories with the same name
                    let item_0 = res.body.category[0].name; // Take the first category
                    let items_equals = []; // Store how many

                    for(let i=0;i<res.body.category.length;i++){
                        if(i === 0) { continue; }
                        // If the category isn't equal, change name and compare with the next one
                        if(item_0 != res.body.category[i].name){
                            item_0 = res.body.category[i].name;
                        }else if(item_0 == res.body.category[i].name){
                            items_equals.push(item_0)
                        }
                    }
                    // If length is 0, it means there aren't more than one elements with the same name
                    expect(items_equals).to.have.length(0);
                });
}


module.exports = {
    createANewEstablishment,
    findEstablishments,
    deleteEstablishmentById,
    checkCategoryType,
    createANewCategory,
    deleteACategory,
    searchEstablishmentsByName,
    updateEstablishment,
    updateWrongEstablishment
}