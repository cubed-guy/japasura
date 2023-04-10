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

app = express()

app.use(cors())
app.use(bodyparser.json())

async function query(query) {
	return await pool.query(query)
}

app.get("/login/:userid/:pwd", async (req, res) => {
	console.log("logging in")
	let result;
	console.log("Awaiting query")
	try {
		result = await pool.query("SELECT * FROM users WHERE username=$1;", [req.params.userid])
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

	if (req.params.pwd !== record.password) {
		res.status(401).send("Unauthoized access")
		return
	}

	const token = jwt.sign(
		{
			userId: req.params.username,
			pwd: req.params.pwd,
		},
		'<NO KEY YET>',  // secret key?
		{
			expiresIn: "10m"
		},
	)

	res.send(201, token)
})

app.get("/data/:start_time", (req, res) => {

})

app.listen(34258, "localhost", () => {
	console.log("Server Started")
})
