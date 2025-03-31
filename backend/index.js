import 'dotenv/config'
import express from "express"
import ImageKit from "imagekit"
import cors from "cors"
import mongoose from "mongoose";
import Chat from "./models/chat.js";
import UserChats from "./models/userChats.js";
import { clerkMiddleware } from '@clerk/express'
import { clerkClient, requireAuth, getAuth } from '@clerk/express'

const port = process.env.PORT || 3000;
const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }
))

app.use(express.json());

app.use(clerkMiddleware());

const connect = async () => {
  try {
    await mongoose.connect(process.env.MONGO);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.log(err);
  }
};

const imagekit = new ImageKit({
  urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
  publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
  privateKey: process.env.IMAGE_KIT_PRIVATE_KEY
});

app.get("/api/upload", (req, res) => {
  const result = imagekit.getAuthenticationParameters();
  res.send(result);
});

// app.get('/api/test', requireAuth(), async (req, res) => {
//   // Use `getAuth()` to get the user's `userId`
//   const { userId } = getAuth(req)

//   // console.log('userId', userId);

//   // Use Clerk's JavaScript Backend SDK to get the user's User object
//   const user = await clerkClient.users.getUser(userId)

//   // console.log('user', user);

//   return res.json({ message: "Success!", user });
// })

app.post("/api/chats", requireAuth(), async (req, res) => {
  const { userId } = getAuth(req);
  const { text } = req.body;
  
  try {
    // CREATE A NEW CHAT
    const newChat = new Chat({
      userId: userId,
      history: [{ role: "user", parts: [{ text }] }],
    });

    const savedChat = await newChat.save();

    // CHECK IF THE USERCHATS EXISTS
    const userChats = await UserChats.find({ userId: userId });

    // IF DOESN'T EXIST CREATE A NEW ONE AND ADD THE CHAT IN THE CHATS ARRAY
    if (!userChats.length) {
      const newUserChats = new UserChats({
        userId: userId,
        chats: [
          {
            _id: savedChat._id,
            title: text.substring(0, 40),
          },
        ],
      });

      await newUserChats.save();
    } else {
      // IF EXISTS, PUSH THE CHAT TO THE EXISTING ARRAY
      await UserChats.updateOne(
        { userId: userId },
        {
          $push: {
            chats: {
              _id: savedChat._id,
              title: text.substring(0, 40),
            },
          },
        }
      );

      res.status(201).send(newChat._id);
    }

  } catch (err) {
    console.log(err);
    res.status(500).send("Error creating chat!")
  }
});

app.get('/api/userchats', requireAuth(), async (req, res) => {
  const { userId } = getAuth(req);

  try {
    const userChats = await UserChats.find({ userId })
    res.status(200).send(userChats[0].chats);
  } catch (err) {
    console.log(err);
    res.status(500).send('Error fetching userchats!');
  }
})

app.get('/api/chats/:id', requireAuth(), async (req, res) => {
  const { userId } = getAuth(req);

  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId });
    res.status(200).send(chat);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error fetching chat!");
  }
})

app.put("/api/chats/:id", requireAuth(), async (req, res) => {
  const { userId } = getAuth(req);

  const { question, answer, img } = req.body;

  const newItems = [
    ...(question
      ? [{ role: "user", parts: [{ text: question }], ...(img && { img }) }]
      : []),
    { role: "model", parts: [{ text: answer }] },
  ];

  try {
    const updatedChat = await Chat.updateOne(
      { _id: req.params.id, userId },
      {
        $push: {
          history: {
            $each: newItems,
          },
        },
      }
    );
    res.status(200).send(updatedChat);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error adding conversation!");
  }
});

app.delete('/api/userchats/:chatId', requireAuth(), async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const { userId } = getAuth(req);

    // console.log('Server received delete request for chatId:', chatId);

    // Remove the chat reference from userchats
    const userChats = await UserChats.findOneAndUpdate(
      { userId: userId },
      { $pull: { chats: { _id: chatId } } },
      { new: true }
    );

    if (!userChats) {
      return res.status(404).json({ message: 'User chats not found' });
    }

    // Delete the chat document from the chat collection
    const deletedChat = await Chat.findOneAndDelete({ _id: chatId, userId: userId });

    if (!deletedChat) {
      console.log('Chat document not found');
      return res.status(404).json({ message: 'Chat document not found' });
    }

    res.status(200).json({ message: 'Chat deleted successfully', userChats });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(401).send('Unauthenticated!');
})

app.listen(port, () => {
  connect()
  console.log(`Server running on ${port}`);
})
