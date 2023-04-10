const express = require("express")
const cors = require("cors")
const jwt = require("jsonwebtoken")
const bodyparser = require("body-parser")
const Pool = require("pg").Pool

const pool = new Pool ({
	user: "postgres",
	host: "smaran.ddns.net",
	password: "wholetthedogsout",
	// port: DB_PORT,  // default port
})

const SECRET_KEY = '<NO KEY YET>'  // secret key?

app = express()

app.use(cors())
app.use(bodyparser.json())

app.get("/login", async (req, res) => {
	let result;
	if (!("username" in req.query && "pwd" in req.query)) {
		req.send(400, "Invalid Request Format")
	}
	console.log("Login Request")
	try {
		result = await pool.query("SELECT * FROM users WHERE username=$1;", [req.query.username])
	} catch (err) {
		console.log("Query Failed", err)
		res.status(500).send(err)
		// res.status(500).send("error")
		return
	}

	// use result
	console.log(result.rows)
	if (result.rows.length <= 0) {
		res.status(404).send("User not found")
		return
	}

	const record = result.rows[0]

	if (req.query.pwd !== record.password) {
		res.status(401).send("Unauthoized access")
		return
	}

	const token = jwt.sign(
		{
			username: record.username,
			userid: record.userid,
			pwd: req.query.pwd,
		},
		SECRET_KEY,
		{
			expiresIn: "10m"
		},
	)

	res.send(201, token)
})

app.get("/sensors", async (req, res) => {
	// {token} -> [{}]
	console.log("Sensor Request")
	if (!("token" in req.query)) {
		req.send(400, "Invalid Request Format")
		return
	}

	let token;
	try {
		token = jwt.verify(req.query.token, SECRET_KEY)
	} catch (err) {
		res.send(498, "Invalid Request Token")
		return
	}
	console.log(token)

	let result;
	try {
		result = await pool.query("SELECT sensorname, sensorid, units FROM sensors WHERE ownerid=$1", [token.userid])
		// result = await pool.query("SELECT * FROM sensors")
	} catch (err) {
		console.log("Query Failed", err)
		res.status(500).send(err)
		// res.status(500).send("error")
		return

	}
	
	res.send(200, {rows: result.rows})
	console.log(token.userid)
	
})

app.get("/data", (req, res) => {
	// maybe I can get the username and password from the token itself?
	// res.send(200, req.query)
	// {token, sensorid, to?, from?} -> {data, sensorid, to, from}
	console.log("Data Request")
	if (!("sensorid" in req.query && "token" in req.query)) {
		req.send(400, "Invalid Request Format")
	}
})

app.listen(34258, "localhost", () => {
	console.log("Server Started")
})
