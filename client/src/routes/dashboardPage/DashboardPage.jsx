import { useMutation, useQueryClient } from "@tanstack/react-query";
import "./dashboardPage.scss";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const AssistantOptions = {
  THERAPIST: "Therapist",
  FRIEND: "Friend",
  BOTH: "Both",
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
          <h1>
            Tell me what’s on your mind. <br /> I’m listening
          </h1>
        </div>
        <p className="choose-assistant">choose AI personality</p>
        <div className="options">
          <div className={`option ${chosenAssistant === AssistantOptions.THERAPIST ? "selected" : ""}`} onClick={() => setChosenAssistant(AssistantOptions.THERAPIST)}>
            {/* <img className="assistant-image" src="/chat.png" alt="chat" /> */}
            <span className="assistant-name">Psychiatrist</span>
            <p className="assistant-description">Offers Deep Psychological Insight. </p>
          </div>
          <div className={`option ${chosenAssistant === AssistantOptions.FRIEND ? "selected" : ""}`} onClick={() => setChosenAssistant(AssistantOptions.FRIEND)}>
            {/* <img className="assistant-image" src="/image.png" alt="image" /> */}
            <span className="assistant-name">Best Friend</span>
            <p className="assistant-description">Emotional Support + Friendly Advice.</p>
          </div>
          <div className={`both-option ${chosenAssistant === AssistantOptions.BOTH ? "selected" : ""}`} onClick={() => setChosenAssistant(AssistantOptions.BOTH)}>
            <span className="assistant-name">See both</span>
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
