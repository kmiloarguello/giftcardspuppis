const express = require("express");
const router = express.Router();
const request = require("request");
const https = require("https");
const axios = require('axios');
var cron = require("node-cron");

const { errorGenerator } = require("../utils/curries");

axios.defaults.baseURL = "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br";
axios.defaults.headers.common['X-VTEX-API-AppKey'] = process.env.VTEX_API_KEY;
axios.defaults.headers.common['X-VTEX-API-AppToken'] = process.env.VTEX_API_TOKEN;


router.post("/", async (req, res) => {

  //let orderId = "1075511804077-01";
  let orderId = req.body.OrderId;
  let orderStatus = req.body.State;

  if (orderStatus == "payment-approved") {

    console.log("Verifying order... " + orderId);
    let orderInfo = await getOrderInfo(orderId);
    console.log("Order: " + orderInfo.data.orderId + " verified.");

    let giftcardValue = getGiftcardValue(orderInfo.data);
    let recipientData = getRecipientUserData(orderInfo.data);

    console.log("Order: " + orderInfo.data.orderId + "🤔 Getting user data...");
    let userData = await getProfileData(orderInfo.data);

    console.log("Order: " + orderInfo.data.orderId + "💳 Creating gift Card");
    let newGiftCard = await creatingGiftNewGiftCard(recipientData, giftcardValue, setExpirationGiftDate());
    let giftCardFinalData = await assignValueNewGiftCard(newGiftCard.data, giftcardValue);
    // USELESS
    //let orderInfoUpdate = await setCustomGiftCardData(orderInfo.data.orderFormId,newGiftCard.data.id);
    
    console.log("Order: " + orderInfo.data.orderId + "💳 Updating MD");
    let sendInfoToMD = await createMDGiftCards(orderId, userData.data, recipientData, giftCardFinalData.data)

    return res.json({
      success: true,
      message: "Giftfcard successfully created"
    });

  } else if (orderStatus == "canceled") {

    console.log("Verifying Cancelling order... " + orderId);
    let orderInfo = await getOrderInfo(orderId);
    console.log("Cancel order: " + orderInfo.data.orderId + " verified.");

    console.log("Cancel order: " + orderInfo.data.orderId + "💳 Getting gift Card from MD.");
    let giftCardFound = await getGiftCardDetailsFromMD(orderInfo.data.orderId);

    if(giftCardFound.data.length == 0) {
      console.log("Cancel order: " + orderInfo.data.orderId + "💳 Not giftcard found. EXIT");
      return res.json({
        success: false,
        message: "The giftcard does not exist"
      });
    }

    let giftcardId = giftCardFound.data[0]["giftcardId"];
    console.log("Cancel order: " + orderInfo.data.orderId + "💳 Assigning a NEGATIVE Balance");
    let giftCardToCancel = await getGiftCardById(giftcardId);
    let giftCardCancelled = await assignValueNewGiftCard(giftCardToCancel.data, -1);

    console.log("Cancel order: " + orderInfo.data.orderId + "💳 Updating MD Giftcard");
    let documentId = giftCardFound.data[0]["id"];
    let sendInfoToMD = await updateMDGiftCards(giftCardCancelled.data,documentId);
    console.log("Cancel order: " + orderInfo.data.orderId + "💳 Giftcard: " + giftcardId + " Done!");
    
    return res.json({
      success: true,
      message: "Giftcard cancelled correctly"
    });
    
  } else {
    return res.json({
      success: false
    });
  }
 
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



const getOrderInfo =  (orderId) => {
  return axios.get("/api/oms/pvt/orders/" + orderId);
}

const getGiftcardValue = (order) => {
  let items = order.items;

  if (typeof items != "object" || items.length == 0) return console.log("items is undefined");

  let giftCardProducts = items.filter(item => {
    //console.log("item", item.name)
    // TODO: VERIFY WHEN IS A GIFTCARD
    if (/tarjeta/ig.test(item.name)) {
      return item.price;
    }
  });

  if(giftCardProducts.length == 0) return console.log("There is not giftcard products.");

  // In theory only one product should be returned
  let giftcardPrice = giftCardProducts.map(giftcardproduct => giftcardproduct.price)[0];

  return giftcardPrice;
}


const getProfileData = (order) => {
  let userProfileId = order.clientProfileData.userProfileId;
  return axios.get("/api/profile-system/pvt/profiles/" + userProfileId + "/personalData");
}

const getRecipientUserData = (order) => {
  let customData = order.customData;

  if (!customData || typeof customData == "undefined") return console.log("Custom Data is undefined");

  let recipientData = customData.customApps.map(app => {
    if(app.id == "giftcardrecipient") {
      return app.fields;
    } 
  })[0];

  return recipientData;
}

const setExpirationGiftDate = () => {
  let currentDate = new Date();
  let year = currentDate.getFullYear();
  let month = currentDate.getMonth();
  let day = currentDate.getDate();
  let finalDate = new Date(year + 1, month, day);
  
  return finalDate;
}

const getGiftCardById = (id) => {
  return axios.get("/api/giftcards/" + id );
}

const creatingGiftNewGiftCard = (recipientData, giftCardValue, expiringDate) => {

  let giftCardData = {
    customerId: recipientData.recipientEmail,
    expiringDate,
    balance: giftCardValue,
    cardName: recipientData.recipientCC,
    caption: "Tarjeta-por-" + parseInt(giftCardValue) / 100 + "cliente-" + recipientData.recipientCC,
    multipleCredits: true,
    multipleRedemptions: true,
    restrictedToOwner: true
  }

  return axios.post("/api/gift-card-system/pvt/giftCards", giftCardData);
}


const assignValueNewGiftCard = (giftcard, giftCardValue) => {

  let _giftCardData = {
    value: parseInt(giftCardValue),
  }

  const id = giftcard.id;

  return axios.post("/api/gift-card-system/pvt/giftCards/" + id + "/credit", _giftCardData );
}

const createMDGiftCards = (orderId, userData, recipientData, giftCardData) => {

  const _giftCardFinalData = {
    balance: String(parseInt(giftCardData.balance) / 100),
    expiringDate: giftCardData.expiringDate,
    giftcardId: String(giftCardData.id),
    orderId,
    recipientEmail: recipientData.recipientEmail,
    recipientCC: recipientData.recipientCC,
    recipientName: recipientData.recipientName,
    redemptionCode: giftCardData.redemptionCode,
    email: userData.email,
    userId: userData.userId,
    userName: userData.firstName,
    statusGiftCard: giftCardData.statusGiftCard
  }

  return axios.post("/api/dataentities/GG/documents", _giftCardFinalData);
}


const updateMDGiftCards = (giftCardData, documentId) => {

  let iGiftValue = parseInt(giftCardData.balance) / 100;

  if(iGiftValue <= 0) {
    iGiftValue = 0;
  }

  const _giftCardFinalData = {
    balance: String(iGiftValue),
    statusGiftCard: giftCardData.statusGiftCard || "payment-approved"
  }

  return axios.patch("/api/dataentities/GG/documents/" + documentId, _giftCardFinalData);
}



const getGiftCardDetailsFromMD = (orderId) => {
  return axios.get("/api/dataentities/GG/search?orderId=" + orderId + "&_fields=_all");
}







// deprecated
const createANewGiftCard = (req, res) => {

  let orderIdOptions = {
    url:
      "https://" +
      process.env.ACCOUNTNAME +
      ".vtexcommercestable.com.br/api/oms/pvt/orders/" +
      orderId,
    method: "GET",
    headers: {
      "X-VTEX-API-AppKey": process.env.VTEX_API_KEY,
      "X-VTEX-API-AppToken": process.env.VTEX_API_TOKEN,
      "Content-Type": "application/json",
    },
  };

  console.log("Verificando order .... attendez svp!");
  request(orderIdOptions, (err, response, body) => {
    if (err) console.error(err);
    if (
      response &&
      response.statusCode === 200 &&
      typeof body !== "undefined"
    ) {
      console.log("Order verificada correctamente.");
      let jBody = JSON.parse(body);

      let userProfileId = jBody.clientProfileData.userProfileId;
	  let userName = jBody.clientProfileData.firstName;
	  let giftCardValue = String(jBody.value);

      let getProfileData = {
        url:
          "https://" +
          process.env.ACCOUNTNAME +
          ".vtexcommercestable.com.br/api/profile-system/pvt/profiles/" +
          userProfileId +
          "/personalData",
        method: "GET",
        headers: {
          "X-VTEX-API-AppKey": process.env.VTEX_API_KEY,
          "X-VTEX-API-AppToken": process.env.VTEX_API_TOKEN,
          "Content-Type": "application/json",
        },
      };

      console.log("Accediendo a Profiles....");
      request(getProfileData, (err, response, userBody) => {
        if (err) console.error("ER", err);

        let jUserBody = JSON.parse(userBody);
        let userEmail = jUserBody.email;

        // TODO: Get the expected value from the items (for each one)
        //const giftCardValue = "4500000";

        // TODO: HANGE THIS LATER to DIF of Null
        if (jBody.customData == null) {
          // Get the Gift Card id

          let createGiftCardOpts = {
            url:
              "https://" +
              process.env.ACCOUNTNAME +
              ".vtexcommercestable.com.br/api/gift-card-system/pvt/giftCards",
            method: "POST",
            headers: {
              "X-VTEX-API-AppKey": process.env.VTEX_API_KEY,
              "X-VTEX-API-AppToken": process.env.VTEX_API_TOKEN,
              "Content-Type": "application/json",
            },
            json: true,
            body: {
              customerId: userProfileId,
              // TODO expire in one month at least
              expiringDate: "2020-11-30 00:00:00",
              balance: giftCardValue,
              cardName: "Card-" + orderId,
              caption: "Tarjeta-por-" + parseInt(giftCardValue) / 100,
              multipleCredits: true,
              multipleRedemptions: true,
              restrictedToOwner: true,
            },
          };

          console.log("Creando Gift Card....");
          request.post(createGiftCardOpts, (err, response, giftBody) => {
            if (err) console.error("ER", err);

            let { id } = giftBody;

            let assignPriceGiftCard = {
              url:
                "https://" +
                process.env.ACCOUNTNAME +
                ".vtexcommercestable.com.br/api/gift-card-system/pvt/giftCards/" +
                id +
                "/credit",
              method: "POST",
              headers: {
                "X-VTEX-API-AppKey": process.env.VTEX_API_KEY,
                "X-VTEX-API-AppToken": process.env.VTEX_API_TOKEN,
                "Content-Type": "application/json",
              },
              json: true,
              body: {
                value: giftCardValue,
              },
            };

            console.log("Asignando valor a Gift Card....");
            request.post(
              assignPriceGiftCard,
              (err, response, giftCardValueBody) => {
                if (err) console.error(err);

                let cleanGiftCardValue = String(parseInt(giftCardValue) / 100);

                // UPDATE MD in VTEX to send the info et voilà
                let updateMDOpts = {
                  url:
                    "https://" +
                    process.env.ACCOUNTNAME +
                    ".vtexcommercestable.com.br/api/dataentities/GG/documents",
                  method: "POST",
                  headers: {
                    "X-VTEX-API-AppKey": process.env.VTEX_API_KEY,
                    "X-VTEX-API-AppToken": process.env.VTEX_API_TOKEN,
                    "Content-Type": "application/json",
                  },
                  json: true,
                  body: {
                    balance: cleanGiftCardValue,
                    expiringDate: giftCardValueBody.expiringDate,
                    giftcardId: String(giftCardValueBody.id),
                    orderId: orderId,
                    recipientEmail: recipientEmail,
                    recipientCC: recipientCC,
                    recipientName: recipientName,
                    redemptionCode: giftCardValueBody.redemptionCode,
                    email: userEmail,
                    userId: userProfileId,
                    userName,
                  },
                };

                console.log("Updating in MD....");

                console.log(updateMDOpts.body);

                request.post(updateMDOpts, (err, response, MDbody) => {
                  if (err) console.error(err);

                  res.json({
                    success: true,
                    MDbody,
                  });
                });
              }
            );
          });
        } else {
          res.json({
            success: false,
            message: "Custom Data Empty",
          });
        }
      });

    } else {
      console.log("Rechazada.", response.statusCode, body);
      res.json({
        success: false,
        response,
      });
    }
  });




}





module.exports = router;
