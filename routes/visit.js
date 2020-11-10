const express = require('express');
const router = express.Router();
const ModelEstbl = require("../models/Establishment");
const ModelUser = require("../models/Users");
const ModelShit = require("../models/Shifts");
const ModelVisit = require("../models/Visits");
const ModelLocationUser = require("../models/Location_user");
const keys = require("../config/keys");

//* should get the checkin's quantity at this slot
router.get(
  "/:slot",
  // passport.authenticate(["jwt", "google"], { session: false }),
  (req, res) => {
    const { slot } = req.params;

    return res.json({
      checkin: 12,
      slot
    });
});

//* should get a visit by its id.
router.get(
  "/:id",
  // passport.authenticate(["jwt", "google"], { session: false }),
  (req, res) => {
    const { id } = req.params;

    return res.json({
      id,
      visit: 'return'
    });
});

//* should get a visit by an specific date and establishment.
router.get( //? should be post
  "/",
  // passport.authenticate(["jwt", "google"], { session: false }),
  (req, res) => {
    const { id } = req.params;

    return res.json({
      response: 'hola mundo'
    });
  }
);

//* should allow to make checkin in the time interval not greater than `checkin_max_min`.
router.post(
  "/add",
  // passport.authenticate(["jwt", "google"], { session: false }),
  (req, res) => { 
    //? this should be middleware
    if(typeof req.body != "object") 
      return res.status(400).json({ error: "Values aren't in JSON format."});

    //* Context values
    const id_users = req.user._id;
    const { token, location, checkin_time } = req.body;

    //* Check for all the required data
    if(!token || !location || !checkin_time) 
      return res.status(400).send({ error: "Not enough params" });

    //? el jwt se retorna??
    jwt.verify( //? can we work with asyn await?
      token.split(" ")[1],
      keys.secretOrKey,
      async (err, {exp, qr_info}) => {
        if (err) return res.status(403).json(err);
        // If the code is not expired
        if (checkin_time > exp) {
          return res.status(403).json({
            date_input: checkin_time,
            date_res: exp,
            error: "Code expired",
          });
        }
        // validate qr code
        if(!new RegExp( "_","ig").test(qr_info))
          return res.status(400).json({ error: "Wrong QR code "});

        // qr data
        const id_establishment = response.qr_info.split("_")[0];
        const establishment = await ModelEstbl
                                      .findById(id_establishment)
                                      .catch(message => {
                                        res.json({
                                          success: false,
                                          error: "The Establishment code could not be found.",
                                          message
                                        });
                                      })
        const visit = new ModelVisit({
          
        })
      }
    )

    //* checkin_max_min
    // ? this conditional could be inside the .then() of the promise all?? 🤔
    if(establishment.checkin_max_min < (checkout_time - checkin_time))
      res.status(400).send({ error: "time interval not greater than `checkin_max_min`." })
    
    //* booked shift
    //? Lo que habría que hacer es comparar el ID de visitas dentro de Shifts
    // if()
    // res.status(400).send({ error: "Shift and visit doesnt fetch." })



    return res.json(checkin_max_min);
  }
)


module.exports = router;


const getVisitContext = (idEstbl, idUser, idShift) =>
  Promise.all([
    ModelEstbl.findById(idEstbl),
    ModelUser.findById(idUser),
    ModelShit.findById(idShift)
  ])
  // .then(([e,u,s])=>([e,u,s])) //* we can treat the data context here