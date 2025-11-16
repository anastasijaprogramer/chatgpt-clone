import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    chosenAssistant: { type: String, default: "Therapist" },
    history: [
      {
        role: {
          type: String,
          enum: ["user", "model"],
          required: true,
        },
        chosenAssistant: String,
        parts: [
          {
            text: {
              type: String,
              required: true,
            },
          },
        ],
        img: {
          type: String,
          required: false,
        },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.models.chat || mongoose.model("chat", chatSchema);
