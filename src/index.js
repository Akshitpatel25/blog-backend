import express from "express";
import dotenv from "dotenv";
import { z } from "zod";
import { dbConnect } from "./db/db.js";
import { User } from "./models/user.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { Post } from "./models/post.js";
import multer from "multer";
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { Comment } from "./models/comments.js";
import { GoogleGenerativeAI } from "@google/generative-ai";



const userVerification = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string().min(4),
});

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: "Too many requests, please try again later.",
});

dotenv.config();

const app = express();
await dbConnect();



app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    // origin: process.env.FRONTEND_DOMAIN.replace(/\/$/, ""), 
    origin:true,
    credentials: true,
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type,Authorization",
  })
);

// --------------------------------------------------


cloudinary.config({
  cloud_name: process.env.CLOUDNAME,
  api_key: process.env.APIKEY,
  api_secret: process.env.APISECRETKEY
})


// Configure Multer Storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'uploads', // Cloudinary folder name
    format: async (req, file) => 'jpeg', // File format (auto-detects)
    public_id: (req, file) => Date.now() + '-' + file.originalname // Custom filename
  }
});

// **File Filter: Allow Only Images**
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true); // Accept file
  } else {
    cb(new Error('Invalid file type. Only images are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }

});


// --------------------------------------------------

const PORT = process.env.PORTENV || 3003;

app.get("/get-token", (req, res) => {
  // console.log(process.env.FRONTEND_DOMAIN);
  try {
    const token =  req.cookies.token;
    if (!token) {
      console.log("No token found");
      return res.status(201).json({ token: null });
    }
    const decoded = jwt.verify(token, process.env.JWTTOKEN);
    res.status(200).json({ token: decoded });
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
});


app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "success" });
});

app.post("/signup", async function (req, res) {
  const { name, email, password } = await req.body;
  console.log(name, email, password);

  const result = userVerification.safeParse({ name, email, password });
  if (!result.success) {
    return res.status(400).json({ message: "invalid input" });
  }
  const exsistingUser = await User.findOne({ email: email });
  if (exsistingUser) {
    return res.status(401).json({ message: "user already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    username: `User_${Date.now()}`,
    name: name,
    email: email,
    password: hashedPassword,
  });
  user.save();
  res.status(200).json({ message: "success" });
});

app.post("/signin",async function (req, res) {
  const { email, password } = await req.body;
  // console.log(email, password);

  const user = await User.findOne({ email: email });
  if (!user) {
    return res.status(401).json({ message: "user not found" });
  }

  const result = await bcrypt.compare(password, user.password);
  if (!result) {
    return res.status(401).json({ message: "invalid credentials" });
  }

  const token = jwt.sign(
    {
      email: user.email,
      _id: user._id,
      name: user.name,
      username: user.username,
    },
    process.env.JWTTOKEN
  );
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000,
  });
  
  res.status(200).json({ message: "success" });
});

app.post("/create-post",upload.single('photo'), async function (req, res) {
  try {
    const { title, discription, user_id, name, username, date } = req.body;
    // console.log(title, discription, user_id, name, username);
    if (!title || !discription || !user_id || !name || !username) {
      return res
        .status(400)
        .json({ message: "Please add Title and Description" });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded!' });
    }

    const post = await Post.create({
      title: title,
      discription: discription,
      user: user_id,
      name: name,
      username: username,
      date: date,
      imageID: req.file.path,
    });

    post.save();

    res.status(200).json({ message: "success" });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error on create post" });
  }
});

app.get("/get-all-posts", async function (req, res) {
  try {
    const posts = await Post.find();
    res.status(200).json({ posts });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Internal Server Error on get all post" });
  }
});

app.get("/get-post/:id", async function (req, res) {
  try {
    const { id } = req.params;
    // console.log(id);
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    return res.status(200).json(post);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error on get post" });
  }
});

app.get("/get-all-userPosts/:id", async function (req, res) {
  try {
    const id = req.params.id;
    const allUserPosts = await Post.find({ user: id });
    return res.status(200).json(allUserPosts);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error on get all user post" });
  }
});

app.post("/delete-post", async function (req, res) {
  try {
    const {id} = req.body;
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    await Post.findByIdAndDelete(id);
    return res.status(200).json({ message: "success" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error on delete post" });
  }
});

app.post('/comment-on-post', async function(req,res) {
  try {
    const {comment, userID, username, name, postID, date, title} = req.body;
    if (!comment || !userID || !postID) {
      return res.status(400).json({message: "Please add comment"});
    }
    // console.log(comment, userID, username, name, postID, date);
    const newComment = await Comment.create({
      comment: comment,
      user: userID,
      username: username,
      name: name,
      post: postID,
      date: date,
      title: title,
    })
    newComment.save();
    const post = await Post.findById(postID);
    post.comments.push(newComment);
    await post.save();

    res.status(200).json({message: "success"});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Internal Server Error on comment",})  
  }
})

app.get('/comments/:id', async function(req,res) {
  try {
    // this "id" is user_ID
    const {id} = req.params;
    const comments = await Comment.find({user: id});
    if (!comments) {
      return res.status(404).json(null)
    }
    // console.log(comments);
    return res.status(200).json(comments)
  } catch (error) {
    return res.status(500).json({message: "Internal Server Error on get comments"})
  }
})

app.post('/delete-comment', async function(req,res) {
  try {
    const {CommentID, PostID} = req.body;
    console.log(CommentID, PostID);
    const comment = await Comment.findById(CommentID);
    if (!comment) {
      return res.status(404).json({message: "Comment not found"})
    }
    await Post.findByIdAndUpdate(
      PostID, 
      { $pull: { comments: { _id: CommentID } } },
      { new: true }
    );
    await Comment.findByIdAndDelete(CommentID);
    return res.status(200).json({message: "success"})
  } catch (error) {
    return res.status(500).json({message: "Internal Server Error on delete comment"})
  }
})


// ---------------------------- AI Discription Generator ------------------------------------


app.post("/ai-discription", async function (req, res) {
  try {
    const {title} = await req.body;
    if (title === "" || title === undefined) {
      return res.status(400).json({ message: "Please add title" });
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINIAPIKEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `Write a discription for the given title: ${title}. The message should not be lesss then 30 words and use simple english vocabilary.`;
    const result = await model.generateContent(prompt);
    
    const responseText = result.response.text(); 

    return res.status(200).json({ message: responseText });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ message: "Internal Server Error on Gemini test", error });
  }
});


  





// ========================================
// ## First way to store file

// const storage = multer.diskStorage({
//   destination: (req, File, cb) => {
    // cb(null, 'uploads/'); ## this is the path where we want to store file in our code base.
//   },
//   filename: (req, file, cb) => {
//     const suffix = Date.now();
//     cb(null, suffix + '-' + file.originalname);
//   }
// })

// const upload = multer({ storage: storage });
//--------------------------------------------
// ## Another way to store file
// ## by this we can directly store photos into string formate in mongodb or any database. but this is not optimized
// const storage = multer.memoryStorage(); 
// const fileBuffer = req.file ? req.file.buffer.toString('base64') : null;
//--------------------------------------------



// app.post("/multer-cloudinary-test", upload.single('photo'), async function(req,res) {
//   try {
//     const {name} = req.body;
//     if (!name) {
//       return res.status(400).json({message: "Please add name"})
//     }
//     // this below condition check whether file is uploaded or not by user
//     if (!req.file) {
//       return res.status(400).json({ message: 'No file uploaded or invalid file type. Only images are allowed!' });
//     }
//     const data = {
//       name: name,
//       file: req.file.path
//     }
//     return res.status(200).json(data)
//   } catch (error) {
//     return res.status(500).json({message: "Internal Server Error on upload file"})
//   }
// })

// this is main used for handle error globally for middlewares 
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large. Max size allowed is 10MB!" });
    }
    return res.status(400).json({ message: err.message });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
});


app.listen(PORT, function () {
  console.log(`Server is running on http://localhost:${PORT}`);
});