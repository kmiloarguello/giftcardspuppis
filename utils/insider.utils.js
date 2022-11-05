
/**
 * @desc    This function creates the object to send to Insider
 * @param {Array} recordset -> Data from Comerssia
 * @param {Array} purchase -> Data from Vtex [{ productId : '', categories : [..]}]
 * @returns 
 */
const transformObjectInsider = (recordset, purchase) => {
    if (!recordset) return console.error("🔴 Error in record set");

    // Helper to avoid construct data from not valid data
    if (recordset.length == 0) return;

    let clientes = recordset.filter(user => user.CLIEmailPrincipal && user.CLIEmailPrincipal.length > 0);

    const categories = purchase && purchase.length > 0 ? purchase.map(p => { return { productId : p[0].productId, categories: p[0].categories } }) : null;

    const users = clientes.map(client => {

        let taxonomy = [];

        if (categories) {
            categories.map(cat => {
                if (cat.productId == client.RFICodigo) {
                    taxonomy.push(cat.categories);
                }
            });
        }
        
        let user = {
            identifiers: {
                email: client.CLIEmailPrincipal,
            },
            attributes: {
                email_optin: true,
                sms_optin: true,
                whatsapp_optin: true,
                name: client.CLINombres,
                surname: client.CLIApellidos,
                birthday: client.CLIFechaNacimiento,
                gender: client.CLISexo && !client.CLISexo.startsWith(" ") ? client.CLISexo : null,
                language: "es-co",
                country: "CO",
                phone_number: getPhoneNumber(client)
            },
            events:[
                {
                    event_name: "purchase",
                    timestamp: client.ENCFechaTrx,
                    event_params : {
                        product_id: client.RFICodigo,
                        unit_price: client.IRFBruto,
                        unit_sale_price: client.IRFVenta,
                        event_group_id: String(client.ENCCodigo),
                        taxonomy: categories ? taxonomy[0] : taxonomy,
                        currency: "COP"   
                    }
                }
            ]
        }

        return user;
    });

    return { users };
}


/**
 * @desc    This function append one user into the set of users
 * @param {Object} usersA 
 * @param {Object} usersB 
 * @returns 
 */
const appendObjectInsider = (usersA, usersB) => {
    if(!usersA || !usersA.users || usersA.users.length == 0) return null;
    if(!usersB || !usersB.users || usersB.users.length == 0) return null;

    usersB.users.map(user => usersA.users.push(user));
    return usersA;
}


/**
 * @desc    This function obtains the customer number
 * @param {Object} client 
 * @returns 
 */
const getPhoneNumber = (client) => {
    let phone_number = "";

    if (client.CLICelular != "N/A" && client.CLICelular.length > 3) {
        if (client.CLICelular.startsWith("+57")) {
            phone_number = client.CLICelular;
        } else if (client.CLICelular.startsWith("57")) {
            phone_number = "+" + client.CLICelular;
        } else {
            phone_number = "+57" + client.CLICelular;
        }
    } else if (client.CLITelefonoCasa != "N/A" && client.CLICelular.length > 3) {
        if (client.CLITelefonoCasa.startsWith("+57")) {
            phone_number = client.CLITelefonoCasa
        } else if (client.CLITelefonoCasa.startsWith("57")) {
            phone_number = "+" + client.CLITelefonoCasa;
        } else {
            phone_number = "+57" + client.CLITelefonoCasa;
        }
    } else {
        phone_number = "";
    }

    return phone_number;
}

module.exports = {
    transformObjectInsider,
    getPhoneNumber,
    appendObjectInsider
}