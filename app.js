const express = require("express");
const app = express();
app.use(express.json());

const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Running.... :-]");
    });
  } catch (err) {
    console(`DB Error: ${err.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//API-1

//AFTER login api
//-> If the token is not provided by the user or an invalid token <-

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  ////Authentication Scenario 1
  //If the token is not provided by the user or an invalid token
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        //Authentication Scenario 2
        //After successful verification of token proceed to next middleware or handler
        request.username = payload.username;
        next();
      }
    });
  }
};

//USER LOGIN AUTHENTICATION

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  //Scenario-1
  //If an unregistered user tries to login
  const checkUserQuery = `
        SELECT * 
            FROM user
        WHERE
            username='${username}';`;
  const checkUserResponse = await db.get(checkUserQuery);
  if (checkUserResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const checkPasswordMatch = await bcrypt.compare(
      password,
      checkUserResponse.password
    );

    //SCENARIO-2
    //If the user provides an incorrect password
    if (checkPasswordMatch === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      //SCENARIO-3
      //Successful login of the user
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    }
  }
});

//API-2

//Convert LIST OF ALL STATES TO OBJECT
const convertStatesDBObject = (obj) => {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  };
};

//GET LIST OF ALL STATES
app.get("/states/", authenticationToken, async (request, response) => {
  const getStatesListQuery = `
  SELECT * 
    FROM state;`;

  const getStatesListResponse = await db.all(getStatesListQuery);
  response.send(
    getStatesListResponse.map((eachState) => convertStatesDBObject(eachState))
  );
});

//API-3
//GET STATE BASED ON ID
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatesByIdQuery = `
  SELECT * 
    FROM state 
  WHERE state_id=${stateId};`;
  const getStatesListByIdResponse = await db.get(getStatesByIdQuery);
  response.send(convertStatesDBObject(getStatesListByIdResponse));
});

//API 4
//POST CREATE A DISTRICT IN DISTRICT TABLE

app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
  INSERT INTO 
        district(district_name,state_id,cases,cured,active,deaths)
    VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  const createDistrictQueryResponse = await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//API 5

//CONVERT DISTRICT TO OBJECT
const convertDistrictDBObject = (obj) => {
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  };
};

//GET DISTRICT BASED ON ID'S
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictByIdQuery = `
  SELECT * 
    FROM district 
  WHERE 
    district_id=${districtId};`;

    const getDistrictByIdResponse = await db.get(getDistrictByIdQuery);
    response.send(convertDistrictDBObject(getDistrictByIdResponse));
  }
);

//API-6
//DELETE DISTRICT BY ID

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictByIdQuery = `
    DELETE FROM 
        district
    WHERE district_id=${districtId}`;
    await db.run(deleteDistrictByIdQuery);
    response.send("District Removed");
  }
);

//API-7
//PUT UPDATE DISTRICT IN DB BASED PROVIDED ID

app.put(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictByIdQuery = `
    UPDATE 
        district
    SET
        district_name='${districtName}',
        state_id=${stateId},
        cases=${cases},
        cured=${cured},
        active=${active},
        deaths=${deaths}
    WHERE 
        district_id=${districtId};`;
    await db.run(updateDistrictByIdQuery);
    response.send("District Details Updated");
  }
);

//API-8
//Returns the statistics of total cases, cured, active,
//deaths of a specific state based on state ID
//GET
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getCovidStatisticsQuery = `
    SELECT sum(cases) as totalCases,
        sum(cured) as totalCured,
        sum(active) as totalActive,
        sum(deaths) as totalDeaths
    FROM 
        district
    WHERE 
        state_id=${stateId};`;

    const getCovidStatisticsResponse = await db.get(getCovidStatisticsQuery);
    response.send(getCovidStatisticsResponse);
  }
);

module.exports = app;
