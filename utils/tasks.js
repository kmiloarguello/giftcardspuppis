
var cron = require('node-cron');
const fs = require('fs');
let { sendConfirmationEmail } = require('./utils');
const mongoose = require('mongoose');
const Owner = mongoose.model('Owner');
const Users = mongoose.model('Users');
const Establishment = mongoose.model('Establishment');
const QrCode = mongoose.model('QrCode');

/// Check the if establishment has QR code
/// If not send an email to the owner each Monday
cron.schedule("00 20 * * Monday", async () => {
    let establishments = await Establishment.find({ isActive: true } , (err) => err ? console.error("ERROR", err) : "");

    if(establishments.length > 0){
        let emailsToSend = Promise.all( establishments.map(async establishment => {
            let qr = await QrCode.find({ id_establishment: establishment._id }, (err) => err ? console.error(err) : "" )
            
            // These are establishments whose don't have still a QR code
            if( !new RegExp(establishment._id).test(qr.id_establishment) ){

                // Get the owner email
                let owner = await Owner.findById(establishment.id_owner, (err) => err ? console.error(err) : "");

                if(owner && owner.email){
                    return owner.email;
                }
            }
        }));


        emailsToSend
            .then(emails => {
                let _emails = [ ...new Set(emails) ];
                
                let subjectEmail = `🚀 Start using your personalized QR code today.`;
                let descritionEmail = `
                    Recently, You've created an account at Confflux. 
                    
                    We really encourage you to download your personalized QR code for your establishment.
                    
                    Go to https://confflux.com/

                    See you there,

                    Camilo
                    Confflux
                    `;

                
                //_emails.map(email => {
                //    sendConfirmationEmail({ author: "Camilo", email, subject: subjectEmail, description: descritionEmail });
                //});
            })
            .catch(err => console.error("ERROR", err));
    }
});




