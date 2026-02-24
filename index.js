const express = require("express");
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors(({
  origin: ['http://localhost:5173'], // frontend url
  credentials: true
})));
app.use(express.json());
app.use(cookieParser())


const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token

  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}


const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASSWORD}@cluster0.lfj8fm4.mongodb.net/?appName=Cluster0`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("AshirParFoodballClub");

    const playersCollection = db.collection("players");
    const scoresCollection = db.collection("scores");
    const NextMatchCollection = db.collection("nextmatch");
    const userCollection = db.collection("users");
    const newsCollection = db.collection("news");


    // jwt route
    // Frontend can call this after Firebase login
    app.post("/jwt", async (req, res) => {
      const { email } = req.body;

      try {
        const user = await userCollection.findOne({ email });
        if (!user) return res.status(404).send({ message: "User not found" });

        const token = jwt.sign(
          { email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: "365d" }
        );

        res
          .cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true, token });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });
    // logout route
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
      } catch (err) {
        res.status(500).send(err)
      }
    })


    // users route
    // Register User
    app.post("/users", async (req, res) => {
      const { name, email, photoURL, role } = req.body;

      try {
        const existingUser = await userCollection.findOne({ email });

        // ✅ If user already exists → just return success
        if (existingUser) {
          return res.send({
            success: true,
            message: "User already exists",
            user: existingUser,
          });
        }

        // ✅ If new user → insert into DB
        const result = await userCollection.insertOne({
          name,
          email,
          photoURL: photoURL || "",
          role: role || "user",
          createdAt: new Date(),
        });

        res.send({
          success: true,
          message: "User created successfully",
          insertedId: result.insertedId,
        });

      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });


    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;

      const user = await userCollection.findOne({ email });

      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }

      res.send(user);
    });
    // players route
   // players route
app.get("/players", async (req, res) => {
  const players = await playersCollection.find().toArray();
  res.send(players);
});

// create new player - safe route
app.post("/players", verifyToken, async (req, res) => {
  try {
    // Optional: only admin can add players
    if (req.user.role !== "admin") {
      return res.status(403).send({ message: "Forbidden: Admins only" });
    }

    const { name, image, role } = req.body;

    if (!name || !image || !role) {
      return res.status(400).send({ message: "All fields are required" });
    }

    const result = await playersCollection.insertOne({
      name,
      image,
      role,
      createdAt: new Date(),
    });

    res.send({
      success: true,
      message: "Player added successfully",
      insertedId: result.insertedId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Server error" });
  }
});
    // scores route 
    app.get("/scores", async (req, res) => {
      const scores = await scoresCollection.find().toArray();
      res.send(scores);
    });
    app.post("/scores",verifyToken, async (req, res) => {
      const score = req.body;
      const result = await scoresCollection.insertOne(score);
      res.send(result);
    });
    // matches route
    app.get("/nextmatch", async (req, res) => {
      const Nextmatch = await NextMatchCollection.find().sort({ _id: -1 }).limit(1).toArray();
      res.send(Nextmatch);
    });

    app.post("/nextmatch",verifyToken, async (req, res) => {
      const match = req.body;
      const result = await NextMatchCollection.insertOne(match);
      res.send(result);
    });


    // news route

    app.post("/news", async (req, res) => {
      const news = req.body;
      const result = await db.collection("news").insertOne(news);
      res.send(result);
    });

    app.get("/news", async (req, res) => {
      const category = req.query.category;

      let query = {};
      if (category) {
        query = { category: category };
      }

      const result = await newsCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/news/:id", async (req, res) => {
      const { id } = req.params;
      const newsItem = await newsCollection.findOne({ _id: new ObjectId(id) });
      res.send(newsItem);
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);
// test route
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

// start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
