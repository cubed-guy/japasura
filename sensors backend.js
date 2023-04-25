// http://localhost:34258/login?username=samarth&pwd=150a14ed5bea6cc731cf86c41566ac427a8db48ef1b9fd626664b3bfbb99071fa4c922f33dde38719b8c8354e2b7ab9d77e0e67fc12843920a712e73d558e197
// http://localhost:34258/data?sensorid=1&to=1680157231995&token=<token>

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

const app = express()

app.use(cors())
app.use(bodyparser.json())

app.get("/login", async (req, res, next) => {
	let result
	if (!("username" in req.query && "pwd" in req.query)) {
		res.send(400, "Invalid Request Format")
		return
	}
	console.log("Login Request")
	try {
		result = await pool.query("SELECT * FROM users WHERE username=$1", [req.query.username])
	} catch (err) {
		err = {err: err, msg: "Query to database for user information failed"}
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
			expiresIn: "300m"
		},
	)

	console.log(record.userid)

	res.send(201, token)
})

app.get("/sensor_change", async (req, res, next) => {
	// {token} -> [{}]
	console.log("Sensor Request")
	if (!("token" in req.query && "sensorid" in req.query)) {
		res.send(400, "Invalid Request Format")
		return
	}

	//sensor_change?sensor_id&units?&sensorname

	let token
	try {
		token = jwt.verify(req.query.token, SECRET_KEY)
	} catch (err) {
		res.send(498, "Invalid Request Token")
		return
	}
	console.log(token)

	if (token.userid !== 1) {
		res.status(401).send("Unauthorized request for changing sensor metadata")
		return
	}

	let params = [req.query.sensorid]
	let sets = []

	if ("sensorname" in req.query) {
		sets.push(`sensorname=$${params.length + 1}`)
		params.push(req.query.sensorname)
	}
	if ("units" in req.query) {
		sets.push(`units=$${params.length + 1}`)
		params.push(req.query.units)
	}
	
	if (params.length === 0) {
		res.send(400, "Invalid Request Format: Too few parameters")
		return
	}
	
	let result
	try {
		const query = `UPDATE sensors SET ${sets.join(", ")} WHERE sensorid=$1`
		result = await pool.query(query, params)
		console.log(query)
		// result = await pool.query("SELECT * FROM sensors")
	} catch (err) {
		console.log("Query Failed", err)
		res.status(500).send({err: err, msg: "Query to database for sensor information failed"})
		// res.status(500).send("error")
		return

	}
	
	res.send(200, {rows: result.rows})
	console.log(token.userid)
	
})


app.get("/sensors", async (req, res, next) => {
	// {token} -> [{}]
	console.log("Sensor Request")
	if (!("token" in req.query)) {
		res.send(400, "Invalid Request Format")
		return
	}

	let token
	try {
		token = jwt.verify(req.query.token, SECRET_KEY)
	} catch (err) {
		res.send(498, "Invalid Request Token")
		return
	}
	console.log(token)

	let result
	try {
		result = await pool.query("SELECT sensorname, sensorid, units FROM sensors WHERE ownerid=$1", [token.userid])
		// result = await pool.query("SELECT * FROM sensors")
	} catch (err) {
		console.log("Query Failed", err)
		res.status(500).send({err: err, msg: "Query to database for sensor information failed"})
		// res.status(500).send("error")
		return

	}
	
	res.send(200, {rows: result.rows})
	console.log(token.userid)
	
})

app.get("/data", async (req, res, next) => {
	// res.send(200, req.query)
	// {token, sensorid, to?, from?} -> {data, sensorid, to, from}
	console.log("Data Request")
	if (!("sensorid" in req.query && "token" in req.query)) {
		res.send(400, "Invalid Request Format")
		return
	}
	let token
	try {
		token = jwt.verify(req.query.token, SECRET_KEY)
	} catch (err) {
		res.send(498, "Invalid Request Token")
		return
	}
	console.log(token)

	let result

	try {
		result = await pool.query("SELECT ownerid FROM sensors WHERE sensorid=$1", [req.query.sensorid])
	} catch (err) {
		console.log("Query Failed", err)
		res.status(500).send({err: err, msg: "Could not query ownerid info from database"})
		// res.status(500).send("error")
		return
	}

	// there should be 1 or 0 rows
	if (result.rows.length <= 0) {  // sensor does not exist
		res.status(404).send("Sensor not found")
		return;
	}
	if (result.rows[0].ownerid !== token.userid) {  // user does not own the sensor
		res.status(404).send("Sensor not found")
		return;
	}

	let range_condition = ""
	let query_subs = [req.query.sensorid]
	if ("to" in req.query) {
		range_condition += ` AND time < $${query_subs.length+1}`
		query_subs.push(new Date(parseInt(req.query.to)).toISOString())
	}
	if ("from" in req.query) {
		range_condition += ` AND time >= $${query_subs.length+1}`
		query_subs.push(new Date(parseInt(req.query.from)).toISOString())
	}

	console.log(range_condition, query_subs)
	try {
		result = await pool.query(`
			SELECT time, val FROM sensor_data
			WHERE
				sensorid=$1
				${range_condition}
			ORDER BY time`, query_subs)
	} catch (err) {
		console.log("Query Failed", err)
		res.status(500).send({err: err, msg: "Query to database for sensor data failed"})
		// res.status(500).send("error")
		return
	}
	
	// console.log(result.rows[0].time, result.rows[result.rows.length-1].time)
	console.log(token.username)
	
	if (result.rows.length <= 0) {
		res.send(200, {data: result.rows, sensorid: req.query.sensorid})
		return
	}

	console.log(result.rows[0], token)
	
	// from is inclusive
	let from = new Date(result.rows[0].time).getTime()
	// to is exclusive
	let to   = new Date(result.rows[result.rows.length-1].time).getTime()+1
	
	res.send(200, {data: result.rows, sensorid: req.query.sensorid, to: to, from: from})
})

app.listen(34258, "0.0.0.0", () => {
	console.log("Server Started")
})
