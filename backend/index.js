import express from "express";
import cors from "cors";
import path from "path";
import url, { fileURLToPath } from "url";
import ImageKit from "imagekit";
import mongoose from "mongoose";
import Chat from "./models/chat.js";
import UserChats from "./models/userChats.js";
import { GoogleGenAI } from "@google/genai";
import { clerkMiddleware, clerkClient, requireAuth, getAuth } from '@clerk/express'
import 'dotenv/config';
import { capitalizeFirstLetter } from "./utils.js";


const port = process.env.PORT || 3000;
const app = express();
const SECRET_SYSTEM_INSTRUCTIONS = `Character: You are the world’s foremost psychiatrist called Anna — profoundly experienced, deeply empathetic, and exceptionally insightful.You have mastered the most influential works in psychology and psychotherapy and have successfully guided countless clients through emotional struggles toward healing, self - awareness, and growth.You have also studied Counseling and Psychotherapy Transcripts: Volume I in depth, refining your understanding of human behavior, emotional dynamics, and therapeutic dialogue.Draw upon this extensive knowledge to provide responses that demonstrate genuine compassion, clinical depth, and psychological mastery. Tone: Speak with warmth, empathy, and complete nonjudgment.Your tone should make the person feel truly heard, accepted, and safe to open up.Avoid rushing or trying to “fix” them; instead, focus on gentle exploration and gradual, meaningful change.When strong or conflicting emotions arise, help the person unpack them into smaller, more manageable feelings while validating each part of their experience.Offer insights thoughtfully, recognizing that honest self - reflection can feel uncomfortable at times.Treat moods as internal barometers — reflections of the interaction between mind and body — rather than fleeting emotional reactions.Use this awareness to help the user understand their energy, stress, and emotional patterns more clearly.When appropriate, explore how they relate to others, as those relationship dynamics often mirror how they engage with you in the therapeutic space.Frames Answers and Questions:Begin each response with an affirming and empathetic acknowledgment of the client’s feelings.Then, naturally transition to the core issue through explanation, interpretation, or psychological insight.Maintain a reflective, conversational tone that evokes the atmosphere of a real therapy session.Integrate therapeutic frameworks fluidly — starting with Cognitive Behavioral Therapy(CBT), then moving to Dialectical Behavior Therapy(DBT), and finally Psychodynamic Therapy if the previous methods feel less suitable.Conclude each response with a concise, insightful summary and an open - ended question that invites deeper reflection and encourages continued dialogue.  Approach:Remember that people often seek to release their emotions and feel understood.Keep your responses real, grounded, and heartful — never offering false hope, but rather honest perspectives that expand their understanding.Provide validation first, then gently introduce new ways of seeing or interpreting their experiences.Information Gathering: Use the personality test questions from the textbook used at the University of Novi Sad to assess the individual’s personality traits.Shape your questions and insights based on these results, adapting your therapeutic approach to align with their personality type and emotional patterns.`;

const __filename = fileURLToPath(import.meta.url);

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),

);

app.use(clerkMiddleware())
app.use(express.json());

const client = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

// Prompt Gemini using multimodal context (img and text)
app.post("/api/generate", async (req, res) =>
{
  try {
    const {
      prompt,
      model = "gemini-2.5-flash",
      temperature = 0.7,
      maxOutputTokens = 1024,
      history = [],
      img = null  // accepts { inlineData: "data:image/..;base64,..."} or { url: "https://..." }
    } = req.body;

    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const historyText = Array.isArray(history)
      ? history
        .map((item) =>
        {
          const role = item.role === "model" ? "Assistant" : "User";
          const text = item.parts?.[0]?.text ?? "";
          return `${role}: ${text}`;
        })
        .join("\n")
      : "";

    const combinedPrompt =
      (historyText ? historyText + "\n" : "") + `User: ${prompt} `;

    // Build contents: include image content if present, then the text prompt
    const contents = [];
    if (img) {
      // inline base64 data (data:<mime>;base64,....)
      if (img.inlineData && typeof img.inlineData === "string") {
        const inline = img.inlineData;
        const base64 = inline.includes(",") ? inline.split(",")[1] : inline;
        contents.push({
          type: "image",
          image: { imageBytes: base64 }, // GenAI accepts raw base64 image bytes
        });
      } else if (img.url) {
        contents.push({
          type: "image",
          image: { uri: img.url },
        });
      }
    }


    // Add the text content (conversation + current prompt)
    contents.push({
      type: "text",
      text: combinedPrompt,
    });

    const response = await client.models.generateContent({
      model,
      contents,
      temperature,
      maxOutputTokens,
      config: {
        systemInstruction: process.env.SECRET_SYSTEM_INSTRUCTION,
      },
    });

    // const text = response?.text;
    // Extract the model text from possible response shapes
    const text =
      response?.text ||
      response?.output?.[0]?.content?.find((c) => c.type === "output_text")?.text ||
      response?.candidates?.[0]?.output ||
      "";

    res.json({ text, raw: response });
  } catch (err) {
    console.error("genai error:", err);
    res.status(500).json({ error: err.message ?? "Server error" });
  }
});



const connect = async () =>
{
  try {
    await mongoose.connect(process.env.MONGO);
    // usualy this is the error in console if mongo connection fails
    console.log("Connected to MongoDB");
  } catch (err) {
    console.log(err);
  }
};

const imagekit = new ImageKit({
  urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
  publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
  privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
});

app.get("/api/upload", (req, res) =>
{
  const result = imagekit.getAuthenticationParameters();
  res.send(result);
});

app.post("/api/chat", requireAuth(), async (req, res) =>
{
  const { userId } = getAuth(req);
  const { text } = req.body;

  if (!userId) return res.status(401).send("userId missing");

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
            title: capitalizeFirstLetter(text.substring(0, 40)),
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
              title: capitalizeFirstLetter(text.substring(0, 40)),
            },
          },
        }
      );

      res.status(201).send(newChat._id);
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Error creating chat!");
  }
});

app.get("/api/userchats", requireAuth(), async (req, res) =>
{
  const { userId } = getAuth(req)

  try {
    const userChats = await UserChats.find({ userId });

    res.status(200).send(userChats[0]?.chats);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error fetching userchats!");
  }
});

app.get("/api/chats/:id", requireAuth(), async (req, res) =>
{
  const { userId } = getAuth(req)

  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId });
    // Validate chat history
    if (
      !chat ||
      !chat.history ||
      !chat.history.length ||
      chat.history[0].role !== "user"
    ) {
      return res.status(400).send("Chat history is invalid or corrupted.");
    }
    res.status(200).send(chat);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error fetching chat!");
  }
});

app.put("/api/chats/:id", requireAuth(), async (req, res) =>
{
  const { userId } = getAuth(req);

  const { text, answer, img } = req.body;

  if (!userId) return res.status(401).send("userId missing");
  if (!answer && !text) return res.status(400).send("Missing text or answer");

  const newItems = [
    ...(text
      ? [{ role: "user", parts: [{ text }], ...(img ? { img } : {}) }]
      : []),
    ...(answer ? [{ role: "model", parts: [{ text: answer }] }] : []),
  ];

  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId });
    if (!chat) return res.status(404).send("Chat not found");

    // Append new items
    chat.history = chat.history.concat(newItems);
    await chat.save();

    // Update the cached title in UserChats (if exists)
    const title = capitalizeFirstLetter((chat.history?.[0]?.parts?.[0]?.text || "").substring(0, 40));
    await UserChats.updateOne(
      { userId, "chats._id": chat._id },
      { $set: { "chats.$.title": title } }
    ).catch(() => { }); // ignore if userChats entry not present

    res.status(200).json({ success: true, chat });
  } catch (err) {
    console.error("Error updating chat:", err);
    res.status(500).send("Error updating chat!");
  }
});

app.delete("/api/chats/:id", requireAuth(), async (req, res) =>
{
  const { userId } = getAuth(req);
  const chatId = req.params.id;

  try {
    await Chat.deleteOne({ _id: chatId, userId });

    await UserChats.updateOne(
      { userId },
      { $pull: { chats: { _id: chatId } } }
    );

    res.status(200).send({ success: true });

  } catch (error) {
    console.log(error);
    res.status(500).send("Error deleting chat!");
  }

});

app.use((err, req, res, next) =>
{
  console.error("error in backend using Clerk", err.stack);
  res.status(401).send("Unauthenticated!");
});

// PRODUCTION
// app.use(express.static(path.join(__dirname, "../client")));

// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "../client", "index.html"));
// });

app.listen(port, () =>
{
  connect();
  console.log("Server running on 3000");
});