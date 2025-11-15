import { useMutation, useQueryClient } from "@tanstack/react-query";
import "./dashboardPage.scss";
import { useNavigate } from "react-router-dom";

const DashboardPage = () => {
  const queryClient = useQueryClient();

  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (text) => {
      return fetch(`${import.meta.env.VITE_API_URL}/api/chat`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
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
    const text = e.target.text.value;
    if (!text) return;

    mutation.mutate(text);
  };

  return (
    <div className="dashboardPage">
      <div className="texts">
        <div className="logo">
          <h1>Tell me all about it</h1>
        </div>
        <p className="choose-assistant">Choose your assistant</p>
        <div className="options">
          <div className="option">
            <img className="assistant-image" src="/chat.png" alt="chat" />
            <span className="assistant-name">Therapist</span>
          </div>
          <div className="option">
            <img className="assistant-image" src="/image.png" alt="image" />
            <span className="assistant-name">Friend</span>
          </div>
        </div>
      </div>
      <div className="formContainer">
        <form onSubmit={handleSubmit}>
          <input type="text" name="text" placeholder="Ask me anything..." />
          <button>
            <img src="/arrow.png" alt="" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default DashboardPage;
