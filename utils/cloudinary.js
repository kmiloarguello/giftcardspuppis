/**
 * This file allow us to upload images to cloudinary
 * Make sure you add the environment variables.
 */
const cloudinary = require("cloudinary");
const dotenv = require("dotenv");

dotenv.config();
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Create a promise to upload the files into cloudinary,
 * @returns {url, id} 
 */
exports.uploads = (file, folder) => {
    return new Promise(resolve => {
        cloudinary.uploader.upload(file, (result) => {
            resolve({
                url : result.url,
                id  : result.public_id
            });
        }, {
            resouce_type : "auto",
            folder
        });
    });
}