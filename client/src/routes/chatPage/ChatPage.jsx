import "./chatPage.scss";
import NewPrompt from "../../components/newPrompt/NewPrompt";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import Markdown from "react-markdown";
import { IKImage } from "imagekitio-react";

const ChatPage = () => {
  const path = useLocation().pathname;
  const chatId = path.split("/").pop();
  const queryClient = useQueryClient();

  const { isPending, error, data } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/api/chats/${chatId}`, {
        credentials: "include",
      }).then((res) => res.json()),
  });

  const updateAssistantMutation = useMutation({
    mutationFn: (newAssistant) => {
      return fetch(`${import.meta.env.VITE_API_URL}/api/chats/${chatId}/assistant`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chosenAssistant: newAssistant }),
      }).then((res) => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
    },
  });

  const handleChooseAssistant = (assistant) => {
    updateAssistantMutation.mutate(assistant);
  };

  const renderMessage = (message, i) => {
    const messageText = message.parts[0].text;

    // Check if this is a "Both" mode response
    if (message.role === "model" && messageText.includes("**Therapist:**") && messageText.includes("**Friend:**")) {
      const therapistMatch = messageText.match(/\*\*Therapist:\*\*\s*([\s\S]*?)\n\n\*\*Friend:\*\*/);
      const friendMatch = messageText.match(/\*\*Friend:\*\*\s*([\s\S]*)/);

      if (therapistMatch && friendMatch) {
        // Only show choose buttons if chat is still in "Both" mode
        const showChooseButtons = data?.chosenAssistant === "Both";

        return (
          <div key={i} className="both-responses">
            <div className="response-column therapist">
              <div className="response-header">Psychiatrist (Benny)</div>
              <div className="message">
                <Markdown className="chat-text">{therapistMatch[1].trim()}</Markdown>
              </div>
              {showChooseButtons && (
                <button className="choose-btn therapist-btn" onClick={() => handleChooseAssistant("Therapist")}>
                  Choose Psychiatrist
                </button>
              )}
            </div>
            <div className="response-column friend">
              <div className="response-header">Best Friend (Anna)</div>
              <div className="message">
                <Markdown className="chat-text">{friendMatch[1].trim()}</Markdown>
              </div>
              {showChooseButtons && (
                <button className="choose-btn friend-btn" onClick={() => handleChooseAssistant("Friend")}>
                  Choose Best Friend
                </button>
              )}
            </div>
          </div>
        );
      }
    }

    // Regular single message
    return (
      <div key={i}>
        {message.img && <IKImage urlEndpoint={import.meta.env.VITE_IMAGE_KIT_ENDPOINT} path={message.img} height="300" width="400" transformation={[{ height: 300, width: 400 }]} loading="lazy" lqip={{ active: true, quality: 20 }} />}
        <div className={message.role === "user" ? "message user" : "message"}>
          <Markdown className="chat-text">{messageText}</Markdown>
        </div>
      </div>
    );
  };

  return (
    <>
      <header>
        <span className="model-name">{data?.chosenAssistant === "Both" ? "Benny & Anna" : data?.chosenAssistant === "Therapist" ? "Benny" : "Anna"}</span>
      </header>
      <div className="chatWrapper">
        <div className="chat">
          {isPending ? "Loading..." : error ? "Something went wrong!" : data?.history?.map((message, i) => renderMessage(message, i))}

          {data && !isPending && <NewPrompt data={data} />}
        </div>
      </div>
    </>
  );
};

export default ChatPage;
