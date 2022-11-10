const {
  getOrderInfo,
  hasShippingMethod,
  hasSubscriptionAttachment,
  createMDSubscription,
  getProfileData,
  getRecipientUserData,
  sendASMS
} = require("../utils/orders.utils");

const {
  getGiftCardById,
  getGiftcardValue,
  setExpirationGiftDate,
  creatingGiftNewGiftCard,
  assignValueNewGiftCard,
  createMDGiftCards,
  updateMDGiftCards,
  createLogGiftCardinMD,
  getGiftCardDetailsFromMD
} = require("../utils/giftcards.utils");


exports.update = (req, res) => {

    let orderId = req.body.OrderId;
    let orderStatus = req.body.State;
  
    if (orderStatus == "payment-approved") {
  
      getOrderInfo(orderId)
        .then(orderInfo => {
  
          let giftcardValue = getGiftcardValue(orderInfo.data);
          
          // It is a valid griftcard product
          if (typeof giftcardValue !== "undefined" && giftcardValue && giftcardValue > 0) {
            console.log("✅ Order: " + orderInfo.data.orderId + " has a giftcard.");

            // Check if the order was with Contra Entrega -> If so, then NOT create the giftcard

            const { paymentData } = orderInfo.data;
            const { transactions } = paymentData;

            const itWasContraEntrega = transactions.some(transaction => {
              const _itWasContraEntrega = transaction.payments.some(payment => /contra/ig.test(payment.paymentSystemName.toLowerCase()) && /entrega/ig.test(payment.paymentSystemName.toLowerCase()));
              if (_itWasContraEntrega) return true;
              return false;
            });

            // Only continue when IT ISN'T -> Contra Entrega
            if (!itWasContraEntrega) {
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
                      console.log("❗ Order: " + orderId + ". Error trying to create a giftcard. ", error.message + ", data: " + error.config.data );
                      createLogGiftCardinMD(orderId, "Order: " + orderId + ". Error trying to create a giftcard. " + error.message + ", data: " + error.config.data );
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
              console.log("❗ Order: " + orderId + ". Error trying to create a giftcard.");
              createLogGiftCardinMD(orderId, "Order: " + orderId + ". Error trying to create a giftcard. The payment was Pago contra entrega.");
              return res.json({
                success: false,
                message: "Order: " + orderId + ". Error trying to create a giftcard."
              });
            }
            
            
          } else {
  
            // Flow for Update MD with Subscription Information
            const isAutocompra = hasShippingMethod(orderInfo.data, "Autocompra");
            const hasSubscriptionAttach = hasSubscriptionAttachment(orderInfo.data);
  
            if (isAutocompra && hasSubscriptionAttach) {
              createMDSubscription(orderInfo.data)
              .then(() => {
                console.log("✅ Order: " + orderInfo.data.orderId + " has been sent it back the info to Vtex. EXIT.");
                return res.json({
                  success: true,
                  message: "Subscription successfully created",
                });
              })
              .catch(error => {
                console.log("❗ Order: " + orderId + ". Error saving the new Subscription in Master Data.", error);
                return res.json({
                  success: false,
                  message: "Order: " + orderId + ". Error saving the new Subscription in Master Data."
                });
              });
            } else {
              return res.json({
                success: false,
                message: "This is not a valid Giftcard product"
              });
            }
          }
        })
        .catch(() => {
          console.log("❗ Order: " + orderId + " could not be verified.");
          createLogGiftCardinMD(orderId, "Order: " + orderId + " could not be verified.");
          return res.json({
            success: false,
            message: "Order: " + orderId + " could not be verified."
          });
        });
  
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
          console.log("❗ CANCELING Order: " + orderId + " could not be verified.");
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
                let storeName = null;
  
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
                if(/retiro/ig.test(logisticsInfo[0].selectedSla) || /recoge/ig.test(logisticsInfo[0].selectedSla)) {
  
                  // Do not send SMS for Pickit points
                  if(/Pickit/ig.test(logisticsInfo[0].selectedSla)) {
                    console.log("👮‍♀️ Order: " + orderId + ". The SMS is only sent with a Puppis pickup Point, not with Pickit.");
                    return res.json({
                      success: false,
                      message: "The SMS is only sent with a Puppis pickup Point, not with Pickit."
                    })
                  }
  
                  address = logisticsInfo[0].pickupStoreInfo.address.street + logisticsInfo[0].pickupStoreInfo.address.number;
                  storeName = logisticsInfo[0].pickupStoreInfo.friendlyName;
  
                  sendASMS(firstName, phoneNumber, storeName, address)
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
          console.log("❗ Order: " + orderId + " could not be verified.");
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
     
}