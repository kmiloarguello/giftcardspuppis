const axios = require('axios');

const getOrderInfo =  (orderId) => {
    console.log("⏳ Verifying order... " + orderId);
    return axios.get("/api/oms/pvt/orders/" + orderId);
}

/**
 * @desc  This function returns true if the shipping method selected is the same as the given as parameter
 * @param {object} order 
 * @param {string} shippingMethod Shipping method to search for
 * @returns {boolean}
 */
const hasShippingMethod = (order, shippingMethod = "Autocompra") => {
    let { logisticsInfo } = order.shippingData;
    
    return logisticsInfo.some(logistic => logistic.selectedSla == shippingMethod);
}

/**
 * @desc  This function returns true if the order contains a subscription attachement
 *        - It includes farmat and assinatura
 * @param {object} order 
 * @returns {boolean}
 */
const hasSubscriptionAttachment = (order) => {
    let { items } = order;
  
    return items.some(item => {
      if (item.attachments.length > 0) {
        return item.attachments.some(attach => /assinatura/ig.test(attach.name) || /farmat/ig.test(attach.name)  )
      } else {
        return false;
      }
    });
  
}

/**
 * @desc  This function updates the MD with information of Subscription
 * @param {*} order 
 * @returns {Promise}
 */
const createMDSubscription = (order) => {

    const _subscriptionData = {
      aceptSuscription  : true,
      date              : order.creationDate,
      email             : order.clientProfileData.email,
      orderId           : order.orderId
    };
  
    console.log("⏳ Sending the info to Vtex... 💳 ...");
  
    return axios.post("/api/dataentities/CS/documents", _subscriptionData);
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
 
const sendASMS = (username, phone, storeName, address) => {

  const message = `Puppis: Tu pedido online esta listo para ser recogido en ${storeName} - ${address}. Recuerda presentar tu identificacion y el correo de pedido facturado.`;

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


module.exports = {
  getOrderInfo,
  hasShippingMethod,
  hasSubscriptionAttachment,
  createMDSubscription,
  getProfileData,
  getRecipientUserData,
  sendASMS
}




  
