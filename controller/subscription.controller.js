const axios = require("axios");
const createError = require('http-errors');

exports.findAll = (req, res, next) => {

    const { query } = req;
    const { page, size } = query;
    
    const _page = page && !isNaN(parseInt(page)) ? page : "1";
    const _size = size && !isNaN(parseInt(size)) ? size : "50";

    const URL = "/api/rns/pub/subscriptions";
    const params = { params: { page: _page, size: _size } }
    axios.get(URL, params)
        .then(response => response.data)
        .then(subscriptions => res.json(subscriptions))
        .catch(err => next(createError(err)));

}
exports.findOne = (req, res, next) => {
    const { id } = req.params;
    if (!id) next(createError(400, "There is not ID"));

    const URL = `/api/rns/pub/subscriptions/${id}`;

    axios.get(URL)
        .then(response => response.data)
        .then(subscription => res.json(subscription))
        .catch(err => next(createError(err)));

}
exports.update = (req, res, next) => {
    const { id } = req.params;
    if (!id) next(createError(400, "There is not ID"));

    const body = req.body;
    const URL = `/api/rns/pub/subscriptions/${id}`;
    
    axios.patch(URL, body)
        .then(response => response.data)
        .then(subscription => res.json(subscription))
        .catch(err => next(createError(err)));
}
