const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const port = 3000

const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_KEY)

//middleware
// app.use(cors());
// app.use(express.json());

app.use(cors({
  origin: ['https://lighthearted-zuccutto-6b74a1.netlify.app', 'http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}));
app.use(express.json())
app.use(cookieParser())

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  console.log('Cookie in the middleware', token)

  if (!token) {
    return res.status(401).send({ message: 'Unauthorized Access' })
  }
  //verify token
  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized Access' })
    }
    req.decoded = decoded;
    next()
  })
}



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.q12amc9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
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
    // await client.connect();

    const usersCollection = client.db('conversation_hub').collection('users')
    const postsCollection = client.db('conversation_hub').collection('posts');
    const commentsCollection = client.db('conversation_hub').collection('comments')
    const announcementsCollection = client.db('conversation_hub').collection('announcements')


    //  generate JWT for localstorage

    // app.post('/jwt',(req,res)=>{
    //   const user = {email: req.body.email}
    //   // console.log(user)
    //   const token = jwt.sign(user,process.env.JWT_ACCESS_SECRET, {expiresIn:'1d'})
    //   res.send({token,message:'JWT Created Successfully'})
    // })


    //  generate JWT for cookies

    app.post('/jwt', async (req, res) => {
      const userData = req.body;
      const token = jwt.sign(userData, process.env.JWT_ACCESS_SECRET, { expiresIn: '1d' })

      // set token in the cookies

      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: "none"
      })


      res.send({ success: true })
    })


    app.get('/users', verifyToken, async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.send(users);
        // console.log(users)
      } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });



    app.post('/users', async (req, res) => {
      const newUser = req.body;
      const result = await usersCollection.insertOne(newUser)
      res.send(result)

    })

    app.get('/users/count', verifyToken,  async (req, res) => {
      const count = await usersCollection.countDocuments();
      res.send({ count });
    });


    // user search
    app.get("/users/search", verifyToken,  async (req, res) => {
      //  const email = req.params.email;
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: 'Forbidden: Email mismatch' });
      // }
      const name = req.query.name;
      if (!name) {
        return res.status(400).send({ message: "Missing Name" });
      }

      const regex = new RegExp(name, "i"); // case-insensitive partial match

      try {
        const users = await usersCollection.find({ name: { $regex: regex } })
          // .project({ email: 1, createdAt: 1, role: 1 })
          // .limit(10)
          .toArray();
        res.send(users);
      } catch (error) {
        console.error("Error searching users", error);
        res.status(500).send({ message: "Error searching users" });
      }
    });



    //role based dashboard
    app.get("/users/:email/role",verifyToken, async (req, res) => {
      // const email = req.params.email;
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden: Email mismatch' });
      }

      try {
        const user = await usersCollection.findOne({ email });
        // console.log(email)
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }
        res.send({ role: user.role || 'user' });
      } catch (error) {
        console.error("Error fetching user role", error);
        res.status(500).send({ message: "Failed to get user role" });
      }
    });

    app.get('/users/:email',verifyToken, async (req, res) => {

      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden: Email mismatch' });
      }
      
      try {
        const email = req.params.email;
        const result = await usersCollection.findOne({ email });

        if (!result) {
          return res.status(404).send({ message: "User not found" });
        }

        // console.log(email)

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Server Error', error });
      }
    });


    //  patch
    app.patch("/users/:id/role", verifyToken,  async (req, res) => {

      // const email = req.params.email;
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: 'Forbidden: Email mismatch' });
      // }
      const { id } = req.params;
      const { role } = req.body;

      if (!["admin", "user"].includes(role)) {
        return res.status(400).send({ message: "Invalid role" });
      }

      try {
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role } }
        );
        res.send({ message: `User role updated to ${role}`, result });
      } catch (error) {
        console.error("Error updating user role", error);
        res.status(500).send({ message: "Failed to update user role" });
      }
    });

    app.post('/posts', async (req, res) => {
      const newPost = req.body;
      const result = await postsCollection.insertOne(newPost)
      res.send(result)

    })

    app.get('/posts/count', verifyToken,  async (req, res) => {
      const count = await postsCollection.countDocuments();
      res.send({ count });
    });


    app.get('/posts/:email', verifyToken, async (req, res) => {
       const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden: Email mismatch' });
      }
      try {
        const email = req.params.email;
        // console.log('Incoming email:', email);
        // const result = await postsCollection.find({ email: email }).toArray();
        const result = await postsCollection.find({ email: { $regex: `^${email}$`, $options: 'i' } }).toArray();
        res.status(200).send(result);
      } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });



    // app.get('/posts/recent/:email', async (req, res) => {
    //   const email = req.params.email;
    //   const result = await postsCollection.find({ email }).sort({ _id: -1 }).limit(3).toArray();
    //   res.send(result);
    // });



    app.get('/posts/recent/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden: Email mismatch' });
      }

      const result = await postsCollection.find({ email: email }).sort({ _id: -1 }).limit(3).toArray();
      res.send(result);
    });

    app.get('/posts/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const post = await postsCollection.findOne({ _id: new ObjectId(id) });
    res.send(post);
  } catch (err) {
    res.status(500).send({ message: 'Failed to get post', error: err });
  }
});

    app.delete('/posts/:id', async (req, res) => {

      // const email = req.params.email;
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: 'Forbidden: Email mismatch' });
      // }

      const id = req.params.id;
      const result = await postsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.get('/posts/count/:email',verifyToken, async (req, res) => {
             const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden: Email mismatch' });
      }
      try {
        const email = req.params.email;
        const count = await postsCollection.countDocuments({ email });
        res.send({ count });
      } catch (error) {
        res.status(500).send({ message: 'Error counting posts' });
      }
    });


    app.post('/create-payment-intent', async (req, res) => {
      const amountInCents = req.body.amountInCents
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents, // Amount in cents
          currency: 'usd',
          payment_method_types: ['card'],
        });

        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.patch('/users/upgrade/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden: Email mismatch' });
      }
      try {
        const email = req.params.email;
        const filter = { email };
        const updateDoc = {
          // $set: { badge: 'gold' }
          $set: {
            badge: 'gold',
            subscriptionStatus: 'Membership',
            subscriptionDate: new Date() // optional
          }

        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to upgrade user badge' });
      }
    });


    // app.get('/all-posts',async(req,res)=>{
    //         const post = postsCollection.find()
    //         const result = await post.toArray()
    //         res.send(result)
    //     })


    app.get('/all-posts', async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = 5;
      const skip = (page - 1) * limit;
      const sortByPopularity = req.query.sortByPopularity === 'true';

      try {
        const pipeline = [];

        // Add voteDifference field
        pipeline.push({
          $addFields: {
            voteDifference: { $subtract: ['$upVote', '$downVote'] },
          },
        });

        // Sort by popularity or created_at
        if (sortByPopularity) {
          pipeline.push({ $sort: { voteDifference: -1 } });
        } else {
          pipeline.push({ $sort: { _id: -1 } }); // Newest first
        }

        // Pagination
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limit });

        const posts = await postsCollection.aggregate(pipeline).toArray();
        res.send(posts);
      } catch (error) {
        console.error('Failed to fetch posts:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });




    app.get('/post/:id', verifyToken, async (req, res) => {
      // const email = req.params.email;
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: 'Forbidden: Email mismatch' });
      // }
      const id = req.params.id;
      try {
        const post = await postsCollection.findOne({ _id: new ObjectId(id) });
        if (!post) {
          return res.status(404).send({ message: 'Post not found' });
        }
        res.send(post);
      } catch (error) {
        res.status(500).send({ message: 'Server error', error });
      }
    });


    // PATCH: Upvote a post
    app.patch('/posts/upvote/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const result = await postsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { upVote: 1 } }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Upvote failed', error });
      }
    });

    // PATCH: Downvote a post
    app.patch('/posts/downvote/:id',async (req, res) => {
      try {
        const id = req.params.id;
        const result = await postsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { downVote: 1 } }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Downvote failed', error });
      }
    });

    // // Comment Post API
    // app.post('/comments', async (req, res) => {
    //   const { postTitle, email, commentText,reportedFeedback,status } = req.body;

    //   const newComment = {
    //     postTitle,
    //     email,
    //     commentText,
    //     reportedFeedback,
    //     status:'active',
    //     createdAt: new Date(),
    //   };

    //   const result = await commentsCollection.insertOne(newComment);
    //   console.log(reportedFeedback)
    //   res.send(result);
    // });


    app.post('/comments',  async (req, res) => {

    
      const { postTitle, email, commentText, reportedFeedback } = req.body;

      // Only allow one of the valid options
      const validFeedbacks = ['Inappropriate', 'Spam', 'Offensive'];
      const sanitizedFeedback = validFeedbacks.includes(reportedFeedback)
        ? reportedFeedback
        : null; // or set a default if you prefer

      const newComment = {
        postTitle,
        email,
        commentText,
        reportedFeedback: sanitizedFeedback,
        status: 'active',
        createdAt: new Date(),
      };

      const result = await commentsCollection.insertOne(newComment);
      res.send(result);
    });


    app.get('/comments/count', verifyToken, async (req, res) => {
      const count = await commentsCollection.countDocuments();
      res.send({ count });
    });



    // Route to report a comment (update its feedback)
    app.patch('/comments/report/:id', async (req, res) => {
      const commentId = req.params.id;
      const { reportedFeedback } = req.body;

      const validFeedbacks = ['Inappropriate', 'Spam', 'Offensive'];
      const sanitizedFeedback = validFeedbacks.includes(reportedFeedback) ? reportedFeedback : null;

      if (!sanitizedFeedback) {
        return res.status(400).send({ message: "Invalid feedback type" });
      }

      const result = await commentsCollection.updateOne(
        { _id: new ObjectId(commentId) },
        { $set: { reportedFeedback: sanitizedFeedback } }
      );

      res.send(result);
    });

    // PATCH: Update comment status to inactive
    app.patch('/comments/status/:id', async (req, res) => {
      const commentId = req.params.id;
      const { status } = req.body;

      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).send({ message: "Invalid status value" });
      }

      const result = await commentsCollection.updateOne(
        { _id: new ObjectId(commentId) },
        { $set: { status } }
      );

      res.send(result);
    });




    // Get All Comments
    app.get('/comments/:postTitle', async (req, res) => {
      const postTitle = req.params.postTitle;
      const comments = await commentsCollection
        .find({ postTitle })
        .sort({ createdAt: 1 })
        .toArray();
      res.send(comments);
    });


    //Get comments count
    app.get('/comments/count/:postTitle', async (req, res) => {
      const postTitle = req.params.postTitle;
      const count = await commentsCollection.countDocuments({ postTitle });
      res.send({ count });
    });





    // Get search posts by tag
    app.get('/search-posts', async (req, res) => {
      const tag = req.query.tag;

      if (!tag) {
        return res.status(400).send({ message: 'Tag is required' });
      }

      try {
        const result = await postsCollection
          .find({ tag: { $regex: new RegExp(`^${tag}$`, 'i') } })
          .toArray();

        res.send(result);
      } catch (error) {
        console.error('Error searching posts by tag:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });



    app.post('/announcements', async (req, res) => {
      // const email = req.params.email;
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: 'Forbidden: Email mismatch' });
      // }
      const newAnnouncement = req.body;
      const result = await announcementsCollection.insertOne(newAnnouncement)
      res.send(result)

    })


    //Get announcements count
    app.get("/announcements/count", verifyToken,  async (req, res) => {
      // const email = req.params.email;
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: 'Forbidden: Email mismatch' });
      // }
      const count = await announcementsCollection.countDocuments();
      res.send({ count });
    });


    // Get All announcements 
    app.get('/announcements', verifyToken, async (req, res) => {
      try {
        const announcements = await announcementsCollection.find().toArray();
        res.send(announcements);
      } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.get('/reported-comments', verifyToken, async (req, res) => {
      // const email = req.params.email;
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: 'Forbidden: Email mismatch' });
      // }
      try {
        const reports = await commentsCollection
          .find({ reportedFeedback: { $exists: true } })
          .toArray();
        res.send(reports);
      } catch (err) {
        res.status(500).send({ message: 'Failed to fetch reports', error: err });
      }
    });



    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Conversation!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
