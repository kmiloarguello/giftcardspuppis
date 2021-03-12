const express = require("express");
const router = express.Router();
const request = require("request");
const https = require("https");
const axios = require('axios');
const cron = require("node-cron");
const multer  =   require('multer');
const path = require('path');
const fs = require('fs');

const { errorGenerator } = require("../utils/curries");
const { response } = require("express");

axios.defaults.baseURL = "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br";
axios.defaults.headers.common['X-VTEX-API-AppKey'] = process.env.VTEX_API_KEY;
axios.defaults.headers.common['X-VTEX-API-AppToken'] = process.env.VTEX_API_TOKEN;


router.post("/", (req, res) => {

  let orderId = req.body.OrderId;
  let orderStatus = req.body.State;

  if (orderStatus == "payment-approved") {

    getOrderInfo(orderId)
      .then(orderInfo => {
        let giftcardValue = getGiftcardValue(orderInfo.data);
        
        // It is a valid griftcard product
        if (typeof giftcardValue !== "undefined" && giftcardValue && giftcardValue > 0) {
          console.log("✅ Order: " + orderInfo.data.orderId + " has a giftcard.");
          let recipientData = getRecipientUserData(orderInfo.data);

          getProfileData(orderInfo.data)
            .then(userData => {

              console.log("✅ Order: " + orderInfo.data.orderId + " has correct user data.");           
              creatingGiftNewGiftCard(recipientData, giftcardValue, setExpirationGiftDate())
                .then(newGiftCard => {

                  console.log("✅ Order: " + orderInfo.data.orderId + " has created the giftcard 💳.");
                  assignValueNewGiftCard(newGiftCard.data, giftcardValue)
                    .then(giftCardFinalData => {

                      console.log("✅ Order: " + orderInfo.data.orderId + " has assigned correctly the giftcard balance.");
                      createMDGiftCards(orderId, userData.data, recipientData, giftCardFinalData.data, orderStatus)
                        .then(sendInfoToMD => {

                          console.log("✅ Order: " + orderInfo.data.orderId + " has been sent it back the info to Vtex. EXIT.");
                          return res.json({
                            success: true,
                            message: "Giftfcard successfully created",
                            giftcard: giftCardFinalData.data,
                            masterData: sendInfoToMD.data
                          });
                        })
                        .catch(error => {
                          console.log("❗ Order: " + orderId + ". Error saving the new Giftcard in Master Data.", error);
                          createLogGiftCardinMD(orderId, "Order: " + orderId + ". Error saving the new Giftcard in Master Data.",newGiftCard.data.id );
                          return res.json({
                            success: false,
                            message: "Order: " + orderId + ". Error saving the new Giftcard in Master Data."
                          });
                        });
                    })
                    .catch(error => {
                      console.log("❗ Order: " + orderId + ". Error assigning value to the giftcard.", error);
                      createLogGiftCardinMD(orderId, "Order: " + orderId + ". Error assigning value to the giftcard.",newGiftCard.data.id );
                      return res.json({
                        success: false,
                        message: "Order: " + orderId + ". Error assigning value to the giftcard."
                      });
                    });
                })
                .catch(error => {
                  console.log("❗ Order: " + orderId + ". Error trying to create a giftcard.", error);
                  createLogGiftCardinMD(orderId, "Order: " + orderId + ". Error trying to create a giftcard.");
                  return res.json({
                    success: false,
                    message: "Order: " + orderId + ". Error trying to create a giftcard."
                  });
                });
            })
            .catch(error => {
              console.log("❗ Order: " + orderId + ". Error on User profile Data", error);
              createLogGiftCardinMD(orderId, "Order: " + orderId + ". Error on User profile Data.");
              return res.json({
                success: false,
                message: "Order: " + orderId + ". Error on User profile Data."
              });
            });
        } else {
          return res.json({
            success: false,
            message: "This is not a valid Giftcard product"
          });
        }
      })
      .catch(error => {
        console.log("❗ Order: " + orderId + " could not be verified.", error);
        createLogGiftCardinMD(orderId, "Order: " + orderId + " could not be verified.");
        return res.json({
          success: false,
          message: "Order: " + orderId + " could not be verified."
        });
      })

    

  } else if (orderStatus == "canceled") {

    console.log("Verifying Cancelling order... " + orderId);
    getOrderInfo(orderId)
      .then(orderInfo => {

        getGiftCardDetailsFromMD(orderInfo.data.orderId)
          .then(giftCardFound => {

            // There is at least one giftcard to cancel ?
            if (giftCardFound.data.length > 0) {

              let giftcardId = giftCardFound.data[0]["giftcardId"];
              console.log("✅ Cancel order: " + orderInfo.data.orderId + "💳 Assigning a NEGATIVE Balance");

              getGiftCardById(giftcardId)
                .then(giftCardToCancel => {

                  let giftcardValue = getGiftcardValue(orderInfo.data);

                  assignValueNewGiftCard(giftCardToCancel.data, parseInt((giftcardValue) * -1) )
                    .then(giftCardCancelled => {
                      
                      console.log("✅ Cancel order: " + orderInfo.data.orderId + "💳 Updating MD Giftcard");
                      let documentId = giftCardFound.data[0]["id"];

                      updateMDGiftCards(giftCardCancelled.data,documentId,orderStatus)
                        .then(sendInfoToMD => {

                          console.log("✅ Cancel order: " + orderInfo.data.orderId + "💳 Giftcard: " + giftcardId + " Done! EXIT.");

                          return res.json({
                            success: true,
                            message: "Giftcard canceled correctly",
                            giftcard: giftCardCancelled.data,
                            masterData: sendInfoToMD.data
                          });

                        })
                        .catch(error => {
                          console.log("❗ CANCELING Order: " + orderId + ". Error updating Master Data after canceling the giftcard #" + giftcardId + ".", error);
                          createLogGiftCardinMD(orderId, "CANCELING Order: " + orderId + ". Error updating Master Data after canceling the giftcard #" + giftcardId + ".", giftcardId);
                          return res.json({
                            success: false,
                            message: "CANCELING Order: " + orderId + ". Error updating Master Data after canceling the giftcard #" + giftcardId + "."
                          });
                        })
                    })
                    .catch(error => {
                      console.log("❗ CANCELING Order: " + orderId + ". The giftcard #" + giftcardId + " could not be canceled.", error);
                      createLogGiftCardinMD(orderId, "CANCELING Order: " + orderId + ". The giftcard #" + giftcardId + " could not be canceled.", giftcardId);
                      return res.json({
                        success: false,
                        message: "CANCELING Order: " + orderId + ". The giftcard #" + giftcardId + " could not be canceled."
                      });
                    });
                })
                .catch(error => {
                  console.log("❗ CANCELING Order: " + orderId + ". There is not giftcard #" + giftcardId + " at Vtex. (get by Id)", error);
                  createLogGiftCardinMD(orderId, "CANCELING Order: " + orderId + ". There is not giftcard #" + giftcardId + " at Vtex. (get by Id)", giftcardId);
                  return res.json({
                    success: false,
                    message: "CANCELING Order: " + orderId + ". There is not giftcard #" + giftcardId + " at Vtex."
                  });
                });
            } else {
              console.log("CANCELING order: " + orderInfo.data.orderId + "💳 Not giftcard found. EXIT");
              return res.json({
                success: false,
                message: "CANCELING order: " + orderInfo.data.orderId + "💳 Not giftcard found"
              });
            }
          })
          .catch(error => {
            console.log("❗ CANCELING Order: " + orderId + ". It could not get the giftcard values from Master Data.", error);
            createLogGiftCardinMD(orderId, "CANCELING Order: " + orderId + ". It could not get the giftcard values from Master Data.");
            return res.json({
              success: false,
              message: "CANCELING Order: " + orderId + ". It could not get the giftcard values from Master Data."
            });
          })
      })
      .catch(error => {
        console.log("❗ CANCELING Order: " + orderId + " could not be verified.", error);
        createLogGiftCardinMD(orderId, "CANCELING Order: " + orderId + " could not be verified.");
        return res.json({
          success: false,
          message: "CANCELING Order: " + orderId + " could not be verified."
        });
      })  
  } else if (orderStatus == "invoiced"){
    
    console.log("OrderId " + orderId + " Starting flow SMS... 💌");

    // This code is aimed to send a SMS to the user
    getOrderInfo(orderId)
      .then(orderInfo => {
          getProfileData(orderInfo.data)
            .then(userData => {
              console.log("✅ Order: " + orderInfo.data.orderId + " has correct user data for SMS.");

              // Obtain User data to send the SMS
              let user = userData.data;
              let phoneNumber = null;
              let firstName = userData.data.firstName;
              let address = null; // The addres where the user must be pick up the products

              // If the cellphone exists... use it
              if (!/null/ig.test(user.cellPhone)) {
                phoneNumber = user.cellPhone;

              // If the homeophone exists... use it
              } else if(!/null/ig.test(user.homePhone)) {
                phoneNumber = user.homePhone;

                // There is not available phone
              } else {
                return res.json({
                  success: false,
                  message: "Order: " + orderId + ". The user has not a valid phone number."
                })
              }

              // check if phone number has +57 at the very begining
              // The goal is to having phone numbers like +573123456789
              if (/\+57/i.test(phoneNumber)) {
                // continue

              // If the phone has the 57 but not the +
              } else if(!/\+/i.test(phoneNumber) && /573*/i.test(phoneNumber)){
                phoneNumber = "+" + phoneNumber;

                // If the phone does not have the +57
              } else {
                // add the +57
                phoneNumber = "+57" + phoneNumber;
              }

              // Get information about store to pick up 
              let { logisticsInfo } = orderInfo.data.shippingData;
              
              // This message is only made when the user has a pickup point
              if(/retiro/ig.test(logisticsInfo[0].selectedSla)) {
                let logisticPointInfo = logisticsInfo[0].slas.filter(sla => logisticsInfo[0].selectedSla == sla.name);

                if (logisticPointInfo.length > 0) {
                  // Getting the address
                  address = logisticPointInfo[0].pickupStoreInfo.address.street;

                  console.log("⏳ Sending a SMS to the number " + phoneNumber + " ...");
                  sendASMS(firstName, phoneNumber, address)
                    .then(() => {
                      console.log("✅ Message sent to " + phoneNumber);
                      // Sending the SMS
                      res.json({
                        success: true,
                        message: "The SMS has been sent successfully to the phone number " + phoneNumber
                      })
                    })
                    .catch(error => {
                      console.log("❗ Error sending the LOG information to MD", error);
                      return res.json({
                        success: false,
                        message: "Order: " + orderId + ". There was an error sending the SMS"
                      })
                    })

                } else {
                  console.log("❗ Order: " + orderId + ". Error trying to find the pickup point. Close flow SMS.");
                  return res.json({
                    success: false,
                    message: "Order: " + orderId + ". Error trying to find the pickup point"
                  })
                }
              } else {
                console.log("❗ Order: " + orderId + ". This is not a pickup point. Close flow SMS.");
                return res.json({
                  success: false,
                  message: "Order: " + orderId + ". This is not a pickup point."
                })
              }


            })
            .catch(error => {
              console.log("❗ Order: " + orderId + ". Error on User profile Data", error);
              return res.json({
                success: false,
                message: "Order: " + orderId + ". Error on User profile Data."
              });
            });
      })
      .catch(error => {
        console.log("❗ Order: " + orderId + " could not be verified.", error);
        return res.json({
          success: false,
          message: "Order: " + orderId + " could not be verified."
        });
      })
  } else {
    return res.json({
      success: false
    });
  }

  
 
});


router.post("/sms", (req, res) => {
  console.log("THE BODY IS", req.body);
  
  let orderId = req.body.orderId;
  let orderStatus = req.body.status;

  getOrderInfo(orderId)
      .then(orderInfo => {
          getProfileData(orderInfo.data)
            .then(userData => {
              console.log("✅ Order: " + orderInfo.data.orderId + " has correct user data.");           
              res.json({
                userData
              })
            })
            .catch(error => {
              console.log("❗ Order: " + orderId + ". Error on User profile Data", error);
              return res.json({
                success: false,
                message: "Order: " + orderId + ". Error on User profile Data."
              });
            });
      })
      .catch(error => {
        console.log("❗ Order: " + orderId + " could not be verified.", error);
        return res.json({
          success: false,
          message: "Order: " + orderId + " could not be verified."
        });
      })
});


router.get('/download', async (req, res) => {

  let { query } = req;

  if (Object.keys(query).length == 0 || !/pdf/ig.test(Object.keys(query)[0]) ) {
    res.sendStatus(400);
    return;
  }

  let pdfToSearch = query.pdf;

  fs.readdir(path.resolve(".") +'/uploads', function (err, files) {
    if (err) {
      console.log(err);
      res.sendStatus(400);
      return;
    }

    const foundFiles = files.filter(file => new RegExp(pdfToSearch, "ig").test(file) );

    if (foundFiles.length > 0) {
      const file = foundFiles[0];
      res.download(path.resolve(".") +'/uploads/' + file, file);
    } else {
      res.sendStatus(404);
    }

  });
});



const getOrderInfo =  (orderId) => {
  console.log("⏳ Verifying order... " + orderId);
  return axios.get("/api/oms/pvt/orders/" + orderId);
}


/**
 * @desc  this function determines whether the order has at least one giftcard product
 *        It returns the price from the giftcard
 * 
 * @param {object} order 
 */
const getGiftcardValue = (order) => {
  let items = order.items;

  if (typeof items != "object" || items.length == 0) return console.log("items is undefined");

  let giftCardProducts = items.filter(item => {
    if (/tarjeta/ig.test(item.name) && /regalo/ig.test(item.name)) {
      return item.price;
    }
  });

  if(giftCardProducts.length == 0) return console.log("There is not giftcard products.");

  // In theory only one product should be returned
  let giftcardPrice = giftCardProducts.map(giftcardproduct => giftcardproduct.price)[0];

  return giftcardPrice;
}




const getProfileData = (order) => {
  console.log("⏳ Order: " + order.orderId + "🤔 Getting user data...");
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

  console.log("⏳ Creating gift Card 💳 ...");

  let giftCardData = {
    customerId: recipientData.recipientEmail, // The giftcard will always be attached to this user
    expiringDate,
    balance: giftCardValue,
    cardName: recipientData.recipientCC,
    caption: "Tarjeta-por-" + parseInt(giftCardValue) / 100 + "cliente-" + recipientData.recipientCC,
    multipleCredits: false,
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

  console.log("⏳ Giving value to gift Card #" + id + " 💳 ...");

  return axios.post("/api/gift-card-system/pvt/giftCards/" + id + "/credit", _giftCardData );
}




const createMDGiftCards = (orderId, userData, recipientData, giftCardData, statusGiftCard = "payment-approved") => {

  const _giftCardFinalData = {
    balance: String(parseInt(giftCardData.balance) / 100),
    expiringDate: giftCardData.expiringDate,
    giftcardId: String(giftCardData.id),
    orderId,
    recipientEmail: recipientData.recipientEmail,
    recipientCC: recipientData.recipientCC,
    recipientName: recipientData.recipientName,
    redemptionCode: giftCardData.redemptionCode,
    userEmail: userData.email,
    userId: userData.userId,
    userName: userData.firstName,
    statusGiftCard
  }

  console.log("⏳ Sending the info to Vtex... 💳 ...");

  return axios.post("/api/dataentities/GG/documents", _giftCardFinalData);
}




const updateMDGiftCards = (giftCardData, documentId, statusGiftCard = "canceled") => {

  let iGiftValue = parseInt(giftCardData.balance) / 100;

  if(iGiftValue < 0) {
    iGiftValue = 0;
  }

  const _giftCardFinalData = {
    balance: String(iGiftValue),
    statusGiftCard
  }

  return axios.patch("/api/dataentities/GG/documents/" + documentId, _giftCardFinalData);
}



const createLogGiftCardinMD = (orderId, description, giftcardId, date = new Date().toISOString()) => {

  const _errorGiftcardData = {
    orderId,
    description,
    giftcardId: giftcardId || "",
    date
  }
  
  axios.post("/api/dataentities/EG/documents", _errorGiftcardData)
    .then(() => console.log("LOG information has been sent to Vtex."))
    .catch(error => console.log("Error sending the LOG information to MD", error))
}




const getGiftCardDetailsFromMD = (orderId) => {
  console.log("⏳ Cancel Order: " + orderId + "💳 Getting gift Card from MD.");
  return axios.get("/api/dataentities/GG/search?orderId=" + orderId + "&_fields=_all");
}



const sendASMS = (username, phone, address) => {

  const messageWithAddress = `Hola ${username}, tu pedido de Puppis está listo para ser entregado. Acercate a nuestro punto recogida Puppis. Dirección: ${address} `;
  const messaWithoutAddress = `Hola ${username}, tu pedido de Puppis está listo para ser entregado. Acercate a tu tienda Puppis mas cercana.`;
  
  let message = messageWithAddress;

  if (!address) {
    message = messaWithoutAddress;
  }

  const smsData = {  
    from: "Puppis Colombia",
    to: phone,
    text: message
 }
  
  return axios.post("http://api.messaging-service.com/sms/1/text/single", smsData, {
    headers: {
      'Authorization': `Basic ${process.env.TOKEN_SMS}`
    }
  });
}


module.exports = router;

