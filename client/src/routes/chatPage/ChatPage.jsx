import "./chatPage.scss";
import NewPrompt from "../../components/newPrompt/NewPrompt";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import Markdown from "react-markdown";
import { IKImage } from "imagekitio-react";

const ChatPage = () => {
  const path = useLocation().pathname;
  const chatId = path.split("/").pop();

  const { isPending, error, data } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/api/chats/${chatId}`, {
        credentials: "include",
      }).then((res) => res.json()),
  });

  console.log("data", data);

  return (
    <>
      <header>
        <span className="model-name">{data?.chosenAssistant === "Therapist" ? "Benny" : "Anna"}</span>
      </header>
      <div className="chatWrapper">
        <div className="chat">
          {isPending
            ? "Loading..."
            : error
            ? "Something went wrong!"
            : data?.history?.map((message, i) => (
                <div key={i}>
                  {message.img && <IKImage urlEndpoint={import.meta.env.VITE_IMAGE_KIT_ENDPOINT} path={message.img} height="300" width="400" transformation={[{ height: 300, width: 400 }]} loading="lazy" lqip={{ active: true, quality: 20 }} />}
                  <div className={message.role === "user" ? "message user" : "user"} key={i}>
                    <Markdown className="chat-text">{message.parts[0].text}</Markdown>
                  </div>
                </div>
              ))}

          {data && !isPending && <NewPrompt data={data} />}
        </div>
      </div>
    </>
  );
};

export default ChatPage;
