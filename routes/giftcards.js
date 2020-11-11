const express = require("express");
const router = express.Router();
const request = require("request");
const https = require('https');
var cron = require('node-cron');

const { errorGenerator } = require("../utils/curries");

router.post("/", (req, res) => {

  console.log("Received by trigger...");
  const recipientName = "Vincent J.";
  const recipientEmail = "amigovincent@mailinator.com";
  const recipientCC = "1033123456";

  //let orderId = "1075511804077-01";
  let orderId = req.body.OrderId;
  
  let orderIdOptions = {
		url: "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br/api/oms/pvt/orders/" + orderId,
		method: "GET",
		headers: {
    'X-VTEX-API-AppKey': process.env.VTEX_API_KEY,
    'X-VTEX-API-AppToken': process.env.VTEX_API_TOKEN,
    'Content-Type': 'application/json',
		}
  };
  
  console.log("Verificando order ....");
	request(orderIdOptions, (err, response, body) => {
		if(err) console.error(err);
		if(response && response.statusCode === 200 && typeof body !== "undefined"){

      let jBody = JSON.parse(body);
     
      let userProfileId = jBody.clientProfileData.userProfileId;
      let userName = jBody.clientProfileData.firstName;

      let getProfileData = {
        url: "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br/api/profile-system/pvt/profiles/"+userProfileId+"/personalData",
        method: "GET",
        headers: {
        'X-VTEX-API-AppKey': process.env.VTEX_API_KEY,
        'X-VTEX-API-AppToken': process.env.VTEX_API_TOKEN,
        'Content-Type': 'application/json',
        }
      };


      console.log("Accediendo a Profiles....");
      request(getProfileData, (err, response, userBody) => {
        if(err) console.error("ER",err);

        let jUserBody = JSON.parse(userBody);
        let userEmail = jUserBody.email;


        // TODO: Get the expected value from the items (for each one)
      const giftCardValue = "4500000";

      // TODO: HANGE THIS LATER to DIF of Null
      if (jBody.customData == null) {
        // Get the Gift Card id

        let createGiftCardOpts = {
          url: "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br/api/gift-card-system/pvt/giftCards",
          method: "POST",
          headers: {
          'X-VTEX-API-AppKey': process.env.VTEX_API_KEY,
          'X-VTEX-API-AppToken': process.env.VTEX_API_TOKEN,
          'Content-Type': 'application/json',
          },
          json: true,
          body:{
            customerId: userProfileId, 
            // TODO expire in one month at least
            expiringDate: "2020-11-30 00:00:00",
            balance: giftCardValue,
            cardName: "Card-" + orderId, 
            caption: "Tarjeta-por-" + (parseInt(giftCardValue) / 100),  
            multipleCredits: true, 
            multipleRedemptions: true, 
            restrictedToOwner: true 
          }
        };


        console.log("Creando Gift Card....");
        request.post(createGiftCardOpts, (err, response, giftBody) => {
          if(err) console.error("ER",err);

          let {id} = giftBody;

          let assignPriceGiftCard = {
            url: "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br/api/gift-card-system/pvt/giftCards/"+ id +"/credit",
            method: "POST",
            headers: {
            'X-VTEX-API-AppKey': process.env.VTEX_API_KEY,
            'X-VTEX-API-AppToken': process.env.VTEX_API_TOKEN,
            'Content-Type': 'application/json',
            },
            json: true,
            body:{
              value: giftCardValue 
            }
          };
  
          console.log("Asignando valor a Gift Card....");
          request.post(assignPriceGiftCard, (err, response, giftCardValueBody) => {
            if(err) console.error(err);

            let cleanGiftCardValue = String((parseInt(giftCardValue) / 100));

            // UPDATE MD in VTEX to send the info et voilà
            let updateMDOpts = {
              url: "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br/api/dataentities/GG/documents",
              method: "POST",
              headers: {
              'X-VTEX-API-AppKey': process.env.VTEX_API_KEY,
              'X-VTEX-API-AppToken': process.env.VTEX_API_TOKEN,
              'Content-Type': 'application/json',
              },
              json: true,
              body:{
                balance : cleanGiftCardValue,
                expiringDate : giftCardValueBody.expiringDate,
                giftcardId : String(giftCardValueBody.id),
                orderId : orderId,
                recipientEmail : recipientEmail,
                recipientCC : recipientCC,
                recipientName: recipientName,
                redemptionCode : giftCardValueBody.redemptionCode,
                email: userEmail,
                userId : userProfileId,
                userName
              }
            };

            console.log("Updating in MD....");

            console.log(updateMDOpts.body)

            request.post(updateMDOpts, (err, response, MDbody) => {
              if(err) console.error(err);
  
              res.json({
                success: true,
                MDbody
              });
            });

          });
        });
       
      } else {
        res.json({
          success: false,
          message: "Custom Data Empty"
        })
      }

        
      })

		}else{
      console.log("Rechazada.")
      res.json({
        success: false,
        response
      })
		}
  });

});

/*

{
"Domain":"Fulfillment"
"OrderId":"v52277740atmc-01"
"State":"ready-for-handling"
"LastState":"window-to-cancel"
"LastChange":"2019-08-14T17:11:39.2550122Z"
"CurrentChange":"2019-08-14T17:12:48.0965893Z"
"Origin":{
"Account":"automacaoqa"
"Key":"vtexappkey-appvtex"
}
}

*/



router.get("/get-order", (req,res) => {
  let orderId = "1075511804077-01";
  
  let orderIdOptions = {
		url: "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br/api/oms/pvt/orders/" + orderId,
		method: "GET",
		headers: {
    'X-VTEX-API-AppKey': process.env.VTEX_API_KEY,
    'X-VTEX-API-AppToken': process.env.VTEX_API_TOKEN,
    'Content-Type': 'application/json',
		}
  };
  
  console.log("Verificando order ....");
	request(orderIdOptions, (err, response, body) => {
		if(err) console.error(err);
		if(response && response.statusCode === 200 && typeof body !== "undefined"){

      let jBody = JSON.parse(body);
     
      let userProfileId = jBody.clientProfileData.userProfileId;
      let userName = jBody.clientProfileData.firstName;

      // TODO: Get the expected value from the items (for each one)
      const giftCardValue = "4500000";

      // TODO: HANGE THIS LATER to DIF of Null
      if (jBody.customData == null) {
        // Get the Gift Card id

        let createGiftCardOpts = {
          url: "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br/api/gift-card-system/pvt/giftCards",
          method: "POST",
          headers: {
          'X-VTEX-API-AppKey': process.env.VTEX_API_KEY,
          'X-VTEX-API-AppToken': process.env.VTEX_API_TOKEN,
          'Content-Type': 'application/json',
          },
          body:{
            customerId: userProfileId, 
            // TODO expire in one month at least
            expiringDate: "2020-11-30 00:00:00",
            balance: giftCardValue,
            cardName: "Card-" + orderId, 
            caption: "Tarjeta por: " + (parseInt(giftCardValue) / 100),  
            restrictedToOwner: true 
          }
        };

        console.log("Creando Gift Card....");
        request.post(createGiftCardOpts, (err, response, body) => {
          if(err) console.error(err);

          let id = JSON.parse(body).id;

          let assignPriceGiftCard = {
            url: "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br/api/gift-card-system/pvt/giftCards/"+ id +"/credit",
            method: "POST",
            headers: {
            'X-VTEX-API-AppKey': process.env.VTEX_API_KEY,
            'X-VTEX-API-AppToken': process.env.VTEX_API_TOKEN,
            'Content-Type': 'application/json',
            },
            body:{
              value: giftCardValue 
            }
          };
  
          console.log("Asignando valor a Gift Card....");
          request.post(createGiftCardOpts, (err, response, body) => {
            if(err) console.error(err);

            let jGCBody = JSON.parse(body);

            res.json({
              success: true,
              body: JSON.parse(body)
            })
  
          });
        });
      } else {
        res.json({
          success: false,
          message: "Custom Data Empty"
        })
      }
      
		}else{
      res.json({
        success: false,
        response
      })
		}
  });
})


module.exports = router;
