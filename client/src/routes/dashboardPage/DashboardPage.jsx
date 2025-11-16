import { useMutation, useQueryClient } from "@tanstack/react-query";
import "./dashboardPage.scss";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const AssistantOptions = {
  THERAPIST: "Therapist",
  FRIEND: "Friend",
};

const DashboardPage = () => {
  const queryClient = useQueryClient();
  // eslint-disable-next-line no-undef
  const [chosenAssistant, setChosenAssistant] = useState(AssistantOptions.THERAPIST);

  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (text) => {
      return fetch(`${import.meta.env.VITE_API_URL}/api/chat`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, chosenAssistant }),
      }).then((res) => res.json());
    },
    onSuccess: async (id) => {
      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: ["userChats"] });
      navigate(`/dashboard/chats/${id}`);
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = e.target.prompt?.value;
    if (!text || !chosenAssistant) return;

    mutation.mutate(text);
  };

  return (
    <div className="dashboardPage">
      <div className="texts">
        <div className="logo">
          <h1>Tell me all about it</h1>
        </div>
        <p className="choose-assistant">Choose your assistant AI model</p>
        <div className="options">
          <div onClick={() => setChosenAssistant(AssistantOptions.THERAPIST)} className={`option ${chosenAssistant === AssistantOptions.THERAPIST ? "selected" : ""}`}>
            {/* <img className="assistant-image" src="/chat.png" alt="chat" /> */}
            <span className="assistant-name">Benny</span>
            <p className="assistant-description">Therapist assistant. Let's unpack your feelings in a safe space.</p>
          </div>
          <div onClick={() => setChosenAssistant(AssistantOptions.FRIEND)} className={`option ${chosenAssistant === AssistantOptions.FRIEND ? "selected" : ""}`}>
            {/* <img className="assistant-image" src="/image.png" alt="image" /> */}
            <span className="assistant-name">Anna</span>
            <p className="assistant-description">A good friend. Let's chat about your day or share your thoughts.</p>
          </div>
        </div>
      </div>
      <div className="formContainer">
        <form onSubmit={handleSubmit}>
          <input autoComplete="off" id="prompt" type="text" name="prompt" placeholder="Ask me anything..." />
          <button>
            <img src="/arrow.png" alt="" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default DashboardPage;
