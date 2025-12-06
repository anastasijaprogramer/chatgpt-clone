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

// Safety settings for GenAI. Set GENAI_SAFETY=off to disable.
const DEFAULT_GENAI_SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
];

// Helper function to generate a summarized title using AI
const generateChatTitle = async (userText) =>
{
  try {
    const response = await client.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [{
        type: "text",
        text: `Generate a short, concise title (maximum 5 words) that summarizes this message with no grammar mistakes: "${userText}". Only respond with the title, nothing else.`,
      }],
      config: {
        temperature: 0.3,
        maxOutputTokens: 20,
        safetySettings: DEFAULT_GENAI_SAFETY_SETTINGS,
      },
    });

    const title = response?.text?.trim() || userText.substring(0, 40);
    // Remove quotes if AI wrapped the title in them
    return title.replace(/^"|"$/g, '').substring(0, 50);
  } catch (error) {
    // Fallback to truncated text
    return capitalizeFirstLetter(userText.substring(0, 40));
  }
};
// Prompt Gemini using multimodal context (img and text)
app.post("/api/generate", async (req, res) =>
{
  console.log('💬 API call to /api/generate - Main chat response');
  try {
    const {
      prompt,
      model = "gemini-2.5-flash",
      temperature = 0.7,
      maxOutputTokens = 10024,
      chosenAssistant,
      history = [],
      img = null,
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

    // Handle "Both" case: fetch both Therapist and Friend responses in parallel
    if (chosenAssistant === "Both") {
      const therapistPromise = client.models.generateContent({
        model,
        contents,
        temperature,
        maxOutputTokens,
        config: {
          systemInstruction: process.env.SECRET_THERAPIST_INSTRUCTION,
          safetySettings: DEFAULT_GENAI_SAFETY_SETTINGS,
        },
      });

      const friendPromise = client.models.generateContent({
        model,
        contents,
        temperature,
        maxOutputTokens,
        config: {
          systemInstruction: process.env.SECRET_FRIEND_INSTRUCTION,
          safetySettings: DEFAULT_GENAI_SAFETY_SETTINGS,
        },
      });

      const [therapistResponse, friendResponse] = await Promise.all([
        therapistPromise,
        friendPromise,
      ]);

      const extractText = (response) =>
        response?.text ||
        response?.output?.[0]?.content?.find((c) => c.type === "output_text")?.text ||
        response?.candidates?.[0]?.output ||
        "";

      return res.json({
        therapist: {
          text: extractText(therapistResponse),
          raw: therapistResponse,
        },
        friend: {
          text: extractText(friendResponse),
          raw: friendResponse,
        },
        mode: "both",
      });
    }

    // Single assistant mode (Therapist or Friend)
    const systemInstruction =
      chosenAssistant === "Friend"
        ? process.env.SECRET_FRIEND_INSTRUCTION
        : process.env.SECRET_THERAPIST_INSTRUCTION;

    const response = await client.models.generateContent({
      model,
      contents,
      temperature,
      maxOutputTokens,
      config: {
        systemInstruction,
        safetySettings: DEFAULT_GENAI_SAFETY_SETTINGS,
      },
    });

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
  const { text, chosenAssistant } = req.body;

  if (!userId) return res.status(401).send("userId missing");

  try {
    // CREATE A NEW CHAT
    const newChat = new Chat({
      userId: userId,
      chosenAssistant: chosenAssistant,
      history: [{ role: "user", parts: [{ text, chosenAssistant }] }],
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

  const { text, answer, img, chosenAssistant } = req.body;

  if (!userId) return res.status(401).send("userId missing");
  if (!answer && !text) return res.status(400).send("Missing text or answer");

  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId });
    if (!chat) return res.status(404).send("Chat not found");

    const effectiveChosen = chosenAssistant || chat.chosenAssistant || "Therapist";

    const newItems = [
      ...(text
        ? [{ role: "user", chosenAssistant: effectiveChosen, parts: [{ text }], ...(img ? { img } : {}) }]
        : []),
      ...(answer ? [{ role: "model", chosenAssistant: effectiveChosen, parts: [{ text: answer }] }] : []),
    ];

    // Append new items
    chat.history = chat.history.concat(newItems);
    await chat.save();


    // Send response immediately
    res.status(200).json({ success: true, chat });

    // Generate AI title for the first response AFTER sending response
    if (chat.history.length === 2 && chat.history[0].role === "user") {
      const firstUserMessage = chat.history[0].parts[0].text;


      // Add a delay before making the API call to avoid rate limit issues
      setTimeout(async () =>
      {
        try {
          const generatedTitle = await generateChatTitle(firstUserMessage);
          await UserChats.updateOne(
            { userId, "chats._id": chat._id },
            { $set: { "chats.$.title": generatedTitle } }
          );
        } catch (err) {
          console.error("Error updating chat title:", err);
        }
      }, 10000); // Wait 10 seconds before generating title to avoid rate limits
    }
  } catch (err) {
    console.error("Error updating chat:", err);
    res.status(500).send("Error updating chat!");
  }
});

app.patch("/api/chats/:id/assistant", requireAuth(), async (req, res) =>
{
  const { userId } = getAuth(req);
  const { chosenAssistant } = req.body;

  if (!userId) return res.status(401).send("userId missing");
  if (!chosenAssistant) return res.status(400).send("Missing chosenAssistant");

  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId });
    if (!chat) return res.status(404).send("Chat not found");

    chat.chosenAssistant = chosenAssistant;
    await chat.save();

    res.status(200).json({ success: true, chosenAssistant });
  } catch (err) {
    console.error("Error updating assistant:", err);
    res.status(500).send("Error updating assistant!");
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