import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import "./chatList.scss";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SignedIn, UserButton } from "@clerk/clerk-react";

const ChatList = () => {
  const { pathname } = useLocation();
  const [isChatListOpen, setIsChatListOpen] = useState(true);

  const queryClient = useQueryClient();
  const { isPending, error, data } = useQuery({
    queryKey: ["userChats"],
    queryFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/api/userchats`, {
        credentials: "include",
      }).then((res) => res.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (chatId) =>
      fetch(`${import.meta.env.VITE_API_URL}/api/chats/${chatId}`, {
        method: "DELETE",
        credentials: "include",
      }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userChats"] });
    },
  });

  const toggleChatListOpen = () => {
    setIsChatListOpen((e) => !e);
  };

  return (
    <aside className="sidemenu">
      <Link to="/" className="logo">
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3">
          <path d="M600-360ZM320-242q10 1 19.5 1.5t20.5.5q11 0 20.5-.5T400-242v82h400v-400h-82q1-10 1.5-19.5t.5-20.5q0-11-.5-20.5T718-640h82q33 0 56.5 23.5T880-560v400q0 33-23.5 56.5T800-80H400q-33 0-56.5-23.5T320-160v-82Zm40-78q-117 0-198.5-81.5T80-600q0-117 81.5-198.5T360-880q117 0 198.5 81.5T640-600q0 117-81.5 198.5T360-320Zm0-80q83 0 141.5-58.5T560-600q0-83-58.5-141.5T360-800q-83 0-141.5 58.5T160-600q0 83 58.5 141.5T360-400Zm0-200Z" />
        </svg>
        <span>Doorman AI</span>
      </Link>
      <h6 className="title titleDashboard">DASHBOARD</h6>
      <Link to="/dashboard" className="dashboardLink">
        <svg xmlns="http://www.w3.org/2000/svg" height="21px" viewBox="0 -960 960 960" width="21px" fill="#e3e3e3">
          <path d="M444-288h72v-156h156v-72H516v-156h-72v156H288v72h156v156Zm36.28 192Q401-96 331-126t-122.5-82.5Q156-261 126-330.96t-30-149.5Q96-560 126-629.5q30-69.5 82.5-122T330.96-834q69.96-30 149.5-30t149.04 30q69.5 30 122 82.5T834-629.28q30 69.73 30 149Q864-401 834-331t-82.5 122.5Q699-156 629.28-126q-69.73 30-149 30Zm-.28-72q130 0 221-91t91-221q0-130-91-221t-221-91q-130 0-221 91t-91 221q0 130 91 221t221 91Zm0-312Z" />
        </svg>
        New Chat
      </Link>
      <Link to="/" className="dashboardLink">
        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#e3e3e3">
          <path d="M144-456v-288.27Q144-774 165.5-795q21.5-21 50.5-21h228v360H144Zm228-72Zm144-288h228q29.7 0 50.85 21.15Q816-773.7 816-744v168H516v-240Zm0 672v-360h300v288q0 29-21.15 50.5T744-144H516ZM144-384h300v240H216q-29 0-50.5-21.5T144-216v-168Zm228 72Zm216-336Zm0 216Zm-372-96h156v-216H216v216Zm372-120h156v-96H588v96Zm0 216v216h156v-216H588ZM216-312v96h156v-96H216Z" />
        </svg>
        Explore
      </Link>

      <hr />
      <h6 className={`title ${isChatListOpen ? "open" : "closed"}`} onClick={toggleChatListOpen}>
        CHATS
        <span className="toggle-arrow">
          <svg xmlns="http://www.w3.org/2000/svg" height="10px" viewBox="0 -960 960 960" width="10px" fill="#e3e3e3">
            <path d="m321-80-71-71 329-329-329-329 71-71 400 400L321-80Z" />
          </svg>
        </span>
      </h6>
      <div className={`list ${isChatListOpen ? "open" : "closed"}`}>
        {isPending
          ? "Loading..."
          : error
          ? "Something went wrong!"
          : Array.isArray(data) &&
            data.map((chat) => (
              <div key={chat._id} className={`chat-item ${pathname.includes(chat._id) ? "active" : ""}`}>
                <Link to={`/dashboard/chats/${chat._id}`} style={{ flex: 1 }}>
                  {chat.title}
                </Link>
                <button className="delete-button" onClick={() => deleteMutation.mutate(chat._id)} title="Delete chat">
                  <svg xmlns="http://www.w3.org/2000/svg" height="20px" width="20px" viewBox="0 -960 960 960" fill="#e3e3e3">
                    <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" />
                  </svg>
                </button>
              </div>
            ))}
      </div>
      <hr />
      <div className="bottom">
        <div className="user">
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
        <div className="upgrade">
          <button className="texts">
            <span>Upgrade to Doorman AI Pro</span>
            <span>Get unlimited access to all features</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default ChatList;
