const axios = require('axios');


const getGiftCardById = (id) => {
    return axios.get("/api/giftcards/" + id );
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


const setExpirationGiftDate = () => {
    let currentDate = new Date();
    let year = currentDate.getFullYear();
    let month = currentDate.getMonth();
    let day = currentDate.getDate();
    let finalDate = new Date(year + 1, month, day);
    
    return finalDate;
}

const creatingGiftNewGiftCard = (recipientData, giftCardValue, expiringDate) => {

    console.log("⏳ Creating gift Card 💳 ...");
  
    let cardNameData = recipientData.recipientCC + "_" + new Date().toISOString();
    let email = recipientData.recipientEmail.toLowerCase();
  
    let giftCardData = {
      profileId: email, // The giftcard will always be attached to this user
      relationName: cardNameData,
      cardName: cardNameData,
      expiringDate,
      caption: "Tarjeta-por-" + parseInt(giftCardValue) / 100 + "cliente-" + recipientData.recipientCC,
      multipleCredits: false,
      multipleRedemptions: false,
      restrictedToOwner: true
    }
  
    return axios.post("/api/giftcards", giftCardData);
}

const assignValueNewGiftCard = (giftcard, giftCardValue) => {

    let _giftCardData = {
      value: parseInt(giftCardValue),
    }
  
    if ( !/_/ig.test(giftcard.id) ) return false;
  
    let contentId = giftcard.id;
    let splitContent = contentId.split("_");
    const id = splitContent[splitContent.length - 1];
  
    console.log("⏳ Giving value to gift Card #" + id + " 💳 ...");
  
    return axios.post("/api/gift-card-system/pvt/giftCards/" + id + "/credit", _giftCardData );
}
  
const createMDGiftCards = (orderId, userData, recipientData, giftCardData, statusGiftCard = "payment-approved") => {

    let email = recipientData.recipientEmail.toLowerCase();
  
    const _giftCardFinalData = {
      balance: String(parseInt(giftCardData.balance) / 100),
      expiringDate: giftCardData.expiringDate,
      giftcardId: String(giftCardData.id),
      orderId,
      recipientEmail: email,
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


module.exports = {
    getGiftCardById,
    getGiftcardValue,
    setExpirationGiftDate,
    creatingGiftNewGiftCard,
    assignValueNewGiftCard,
    createMDGiftCards,
    updateMDGiftCards,
    createLogGiftCardinMD,
    getGiftCardDetailsFromMD
}

